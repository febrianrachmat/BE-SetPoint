# Step 10C — Playoff Progression & Champion

| Field | Value |
| --- | --- |
| Document | Playoff Advancement + Champion — Step 10C |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Implemented |
| Last Updated | 2026-07-28 |
| Depends On | Playoff Ready (10B), Match Verify (8C) |
| Out of Scope | Court scheduling for knockout, TV polish |

---

## 1. Flow

```text
Official Locked Bracket matches
  → warm-up / start / score / finish / verify (Match API)
  → match.verified (playoffId + bracketId)
  → planPlayoffAdvancement
  → materialize dependent matches (e.g. Final)
  → when Final verified → Champion declared
```

---

## 2. Pure engine

`planPlayoffAdvancement(structure, verified[], materialized[])`:

- Resolves `winner_of` sides once source matches are verified
- Returns matches to create + optional `championTeamId`

---

## 3. Match gates

`MatchService.requireOperableMatch`:

- Playoff match → `assertPlayoffReady` + official bracket
- Group match → `assertLiveReady` + official schedule

Playoff matches may omit court (MVP).

---

## 4. API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/playoff/champion` | Declared champion |
| (reuse) | Match warm-up/start/score/finish/verify | On official playoff matches |

Events: `playoff.bracket.advanced`, `playoff.champion.declared`

---

## 5. Acceptance

1. Both SF verified → Final match created with winners
2. Final verified → Champion upserted
3. Unit tests for progression planner
4. `nest build` green
