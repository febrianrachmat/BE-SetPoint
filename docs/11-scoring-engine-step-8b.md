# Step 8B — Padel Scoring Engine (Technical Design)

| Field | Value |
| --- | --- |
| Document | Scoring Engine — Step 8B |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Implemented |
| Last Updated | 2026-07-28 |
| Depends On | Match Lifecycle 8A, Category.configuration |
| Out of Scope | Standing recalc (Step 9), full walkover/retired UX |

---

## 1. Purpose

Pure padel scoring:

```text
Point → Game → Set → Match
```

- No NestJS / Prisma inside the engine
- Action-based API (`point scored`), not raw score edits
- Format fully configurable per Category (template + custom override)

---

## 2. Locked product decisions

### 2.1 Where config lives

`Category.configuration.scoring` (JSONB). Tournament may have many Categories with different scoring.

### 2.2 Template + custom

Admin picks a **template** (preset), then may **override** any field before Match Live.

On Match entering `live`, engine stores `configSnapshot` inside `scoreRepresentation` — mid-match rule changes are forbidden.

### 2.3 Deciding set (best of 3/5)

- Default: `full_set`
- Optional: `match_tiebreak` (typically 10 points, win by 2)

Irrelevant for `best_of_1`.

### 2.4 One-set variants (examples)

| Style | gamesTo | tieBreak |
| --- | --- | --- |
| One set GP, TB at 5–5 → 7 | 6 | atGames 5, pointsTo 7 |
| One set GP to 4 | 4 | atGames configurable (e.g. 3) |

All expressed as numbers — one engine.

### 2.5 Deuce

- `golden_point` — at 40–40, next point wins the game
- `advantage` — Ad-In / Ad-Out / back to deuce

### 2.6 Standing

Still: Verified → Standing (Step 9). Score updates never recalculate standings.

### 2.7 Result outcomes

Scoring engine completes matches with implied `normal` result.  
`walkover` / `retired` / cancel paths are Exception/Admin (schema today: `cancelled`, `abandoned`) — contract documented; full UX later.

---

## 3. Scoring config schema

```ts
type MatchFormat = 'best_of_1' | 'best_of_3' | 'best_of_5';
type DeuceMode = 'golden_point' | 'advantage';
type DecidingSet = 'full_set' | 'match_tiebreak';

type TieBreakConfig = {
  atGames: number;   // e.g. 5 → TB when 5-5; 6 → TB when 6-6
  pointsTo: number;  // e.g. 7
  mustWinBy: number; // e.g. 2
};

type ScoringConfig = {
  templateId: string;
  matchFormat: MatchFormat;
  gamesTo: number;
  mustWinBy: number;
  deuceMode: DeuceMode;
  decidingSet: DecidingSet;
  tieBreak: TieBreakConfig;
  matchTieBreak: TieBreakConfig; // used when decidingSet = match_tiebreak
};
```

Category configuration shape:

```json
{
  "teamSize": 2,
  "groupCount": 2,
  "teamsPerGroup": 4,
  "scoring": { /* ScoringConfig */ }
}
```

---

## 4. Template catalog (MVP)

| templateId | Summary |
| --- | --- |
| `one_set_6_gp_tb5` | 1 set, gamesTo 6, GP, TB at 5–5 → 7 (default seed) |
| `one_set_4_gp_tb3` | 1 set, gamesTo 4, GP, TB at 3–3 → 7 |
| `best_of_3_gp_full` | Bo3, GP, TB 6–6 → 7, deciding full set |
| `best_of_3_gp_match_tb` | Bo3, GP, deciding = match TB 10 |
| `best_of_3_advantage_full` | Bo3, advantage, deciding full set |
| `custom` | Admin-supplied fields (validated) |

---

## 5. Match score state (`scoreRepresentation`)

```ts
type Side = 'A' | 'B';

type ScoreState = {
  engineVersion: 'padel-scoring-v1';
  configSnapshot: ScoringConfig;
  sets: SetState[];
  setsWon: { A: number; B: number };
  phase: 'in_progress' | 'completed';
  winnerSide: Side | null;
  serverSide: Side | null; // optional MVP; may stay null until serve tracking
};

type SetState = {
  gamesA: number;
  gamesB: number;
  tieBreak: null | { pointsA: number; pointsB: number };
  game: null | GameState; // null when in set TB / between games / set over
  winnerSide: Side | null;
  isMatchTieBreak: boolean;
};

type GameState = {
  pointsA: number; // 0..3 (0,15,30,40)
  pointsB: number;
  advantageSide: Side | null; // advantage mode only
};
```

---

## 6. Engine API (pure)

```ts
createInitialState(config: ScoringConfig): ScoreState
applyPoint(state: ScoreState, side: Side): ScoreState
// Optional MVP+:
// undo not required in first ship if service keeps previous JSON
isMatchComplete(state: ScoreState): boolean
```

Rules summary:

1. Point in normal game → update 0/15/30/40; GP or Ad at deuce
2. Game won → increment set games; clear game; check set win / start set TB
3. Set TB / match TB → point increments TB points; win by config
4. Set won → increment setsWon; if match won → phase completed; else new set (or match TB if deciding)

---

## 7. Nest wiring (8B)

```text
POST .../matches/:matchId/score/point
Body: { "side": "A" | "B" }

Requires: Live Ready, Match status = live, operator authorized
```

- First point (or on `start`): ensure state initialized from Category scoring (+ template resolve)
- Persist new `scoreRepresentation` + bump `rowVersion`
- Emit `score.updated`
- `finish` requires `phase === 'completed'` (enforced starting 8B)

---

## 8. Editability of Category scoring

Allowed while no Live/Verified matches depend on old rules ideally.  
MVP gate: reject scoring config changes when Category has matches in `live` | `finished` | `verified` (optional soft). Minimum: snapshot at Live start protects in-progress matches.

---

## 9. Acceptance (8B)

1. Pure engine unit tests cover GP game, Ad game, set TB at 5–5→7, one-set to 4, Bo3 full deciding, Bo3 match TB
2. Point action works only in `live`
3. Finish blocked until match completed by engine
4. Templates resolve + custom override validate
5. `nest build` green
