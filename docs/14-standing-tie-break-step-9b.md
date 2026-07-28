# Step 9B — Standing Tie-break Policy

| Field | Value |
| --- | --- |
| Document | Standing Tie-break — Step 9B |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Implemented |
| Last Updated | 2026-07-28 |
| Depends On | Standing Calculator 9A |
| Out of Scope | Admin contested-resolution UX, auto random shuffle, qualification (9C) |

---

## 1. Purpose

Separate **statistics** from **ordering policy**.

```text
accumulateStandings (calculator)
        ↓
orderTeamsByTieBreak (policy pipeline)
        ↓
assignCompetitionRanks
```

Policy can change per Category without rewriting W-L-P math.

---

## 2. Config

`Category.configuration.standings`:

```ts
{
  pointsForWin: 1,
  pointsForLoss: 0,
  tieBreakOrder: [
    'points',
    'wins',
    'head_to_head',
    'set_difference',
    'game_difference'
  ]
}
```

### Criteria

| Id | Meaning |
| --- | --- |
| `points` | Standing points |
| `wins` | Match wins |
| `head_to_head` | Mini-table among **currently tied** teams only |
| `set_difference` | setsWon − setsLost |
| `sets_won` | setsWon |
| `game_difference` | gamesWon − gamesLost |
| `random_draw` | **Does not shuffle.** Marks `tieBreakNotes = random_draw_pending` for Admin (STD-05) |

Default order: points → wins → head_to_head → set_difference → game_difference.

---

## 3. Algorithm

Recursive partition:

1. Take current tied cohort
2. Apply next criterion → sort keys (DESC)
3. Split into equal-key buckets
4. Size 1 → resolved; size > 1 → next criterion
5. Criteria exhausted → `unresolved_tie` + shared competition rank (1,1,3)

Head-to-head mini-table uses only matches where **both** sides are in the cohort; compound key = mini points → wins → set diff → game diff.

---

## 4. Modules

| File | Role |
| --- | --- |
| `standing-calculator.ts` | Accumulate stats only |
| `standing-tie-break.ts` | Policy keys + H2H mini-table + ordering |
| `standing-ranking.ts` | Facade + competition ranks |
| `standing.config.ts` | Resolve `tieBreakOrder` |

---

## 5. Acceptance

1. Custom `tieBreakOrder` changes ranking without changing accumulator
2. H2H resolves two-team points ties when one beat the other
3. `random_draw` → pending notes, shared rank, no silent shuffle
4. Exhausted criteria → `unresolved_tie`
5. `npm run test:standing` + `nest build` green
