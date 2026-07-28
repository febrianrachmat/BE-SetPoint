# Step 9C — Standing Qualification

| Field | Value |
| --- | --- |
| Document | Standing Qualification — Step 9C |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Implemented |
| Last Updated | 2026-07-28 |
| Depends On | Standing Ranking + Tie-break 9A/9B |
| Out of Scope | Cross-group best-2nd, Admin contested UI, Playoff bracket (Step 10) |

---

## 1. Purpose

Stamp who advances from each group **after** final ranks exist.

```text
rankStandings → applyQualification(qualifyTop) → Standing.qualificationStatus
```

Playoff (Step 10) consumes `qualified` teams only — it does not recompute standings.

---

## 2. Config

```ts
configuration.standings.qualifyTop // default 2
```

---

## 3. Rules

Walk competition ranks in order; fill up to `qualifyTop` slots.

| Case | Result |
| --- | --- |
| Same-rank block fits in remaining slots | All in block → `qualified` |
| Block would overflow remaining slots | Block stays `not_qualified` + note `qualification_blocked_tie` (STD-05) |
| `rankPosition > qualifyTop` | `not_qualified` |
| `qualifyTop = 0` | Nobody qualifies |

Example (`qualifyTop = 2`): ranks `1,2,2` → only rank 1 qualifies; the tied #2 block is blocked.

---

## 4. API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/standings/qualified` | Qualified rows only (Playoff intake) |
| POST | `/standings/recalculate` | Recomputes ranks **and** qualification |

Event `standing.recalculated` includes `qualifiedCount` + `qualifiedTeamIds`.

---

## 5. Acceptance

1. Top-N clear ranks qualify
2. Ambiguous cutoff does not invent winners
3. Persisted `qualificationStatus` on Standing rows
4. `npm run test:standing` + `nest build` green
