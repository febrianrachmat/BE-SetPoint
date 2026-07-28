# Step 9A — Standing Engine (Recalculation)

| Field | Value |
| --- | --- |
| Document | Standing Engine — Step 9A |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Implemented |
| Last Updated | 2026-07-28 |
| Depends On | Match Verification 8C (Verified + `getMatchResult`) |
| Out of Scope | Publish/Lock UX polish, contested Admin resolution UI, Playoff qualification automation (9C / Step 10) |

---

## 1. Purpose

Compute **group-stage Standings** from **Verified** matches only.

```text
match.verified → StandingService.recalculate(group)
                 ↑ also Admin POST .../standings/recalculate
```

`MatchService` does not write Standing rows. Standing is a **consumer**.

---

## 2. Input contract

From Verified Match (+ participations):

- `groupId` (required for group-stage MVP)
- `sides.A` / `sides.B` → `teamId`
- `result` from `getMatchResult` (winnerSide, setsWon, sets)

Source of truth in DB: `Match.status = verified` with `groupId` set.

---

## 3. Category criteria (`configuration.standings`)

```ts
type StandingsConfig = {
  pointsForWin: number;   // default 1
  pointsForLoss: number;  // default 0
};
```

Ranking order (deterministic MVP):

1. `points` DESC  
2. `wins` DESC  
3. set difference (`setsWon - setsLost`) DESC  
4. `setsWon` DESC  
5. games difference DESC  
6. Still tied → same `rankPosition`, `tieBreakNotes = 'unresolved_tie'` (STD-05 Admin later)

Qualification stays `not_qualified` in 9A (Step 10 / 9B).

---

## 4. Persistence

Upsert one `Standing` row per `(categoryId, teamId, groupId)` for each Official Drawing group member:

- Reset/recompute `matchesPlayed`, `wins`, `losses`, `points`, `rankPosition`, `tieBreakNotes`, `lastRecalculatedAt`
- Do not invent rows for teams not in the group
- Skip write if Standing row is `lockState = locked` (STD-08) — block group recalc with clear error

---

## 5. API

Base: `/api/v1/tournaments/:tournamentId/categories/:categoryId/standings`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | List; optional `?groupId=` |
| POST | `/recalculate` | Admin; body optional `{ "groupId?" }` — omit = all groups |

Permission: `tournament:manage` for recalculate; list allowed for `tournament:manage` (MVP).

---

## 6. Auto-update (STD-02)

In-process subscriber on `match.verified`:

- If payload has `groupId` or match lookup yields `groupId` → recalculate that group
- Failures are logged; verify itself already succeeded

---

## 7. Acceptance

1. Pure calculator unit tests (W-L-P, set/game tie-break, unresolved ties)
2. Recalc uses Verified only
3. Verify path triggers group recalc without MatchService importing Standing writes directly (via event bus)
4. `nest build` + `test:standing` green
