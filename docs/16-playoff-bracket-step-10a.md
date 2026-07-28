# Step 10A — Playoff Bracket Generator

| Field | Value |
| --- | --- |
| Document | Playoff Bracket Generator — Step 10A |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Implemented |
| Last Updated | 2026-07-28 |
| Depends On | Standing Qualification 9C |
| Out of Scope | Review/Publish/Lock (10B), match progression, Champion (10C) |

---

## 1. Purpose

Generate a **candidate Bracket** from **qualified** Standing rows only.

```text
GET qualified → pure bracket engine → Bracket(candidate) + SF Matches
```

Does not recompute standings. Does not declare winners.

---

## 2. Pairing MVP (`cross_group_standard`)

Assumes `qualifyTop` seeds per group (typically 2) and Official groups labeled `A`, `B`, …

| Field | Rule |
| --- | --- |
| 2 groups × top 2 | SF1: A1 vs B2; SF2: B1 vs A2; Final slot TBD from SF winners |
| 1 group × top 2 | Final only: A1 vs A2 |
| Other shapes | Reject with clear error until extended |

Matches are created only when both sides have known `teamId`. Final placeholder lives in `structureRepresentation` only.

---

## 3. Gates

- Tournament status allows generation (MVP: `live`)
- Playoff not Locked
- No standing note `qualification_blocked_tie` in category
- Enough qualified seeds for the pairing shape
- Official Locked Drawing present (groups exist)

---

## 4. API

Base: `/api/v1/tournaments/:tournamentId/categories/:categoryId/playoff`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Playoff header |
| POST | `/generate` | New candidate Bracket + matches |
| GET | `/brackets` | Version history |
| GET | `/brackets/:bracketId` | Detail + matches |

---

## 5. Artifacts

- `Playoff.qualificationBasis` e.g. `qualifyTop=2;pairing=cross_group_standard`
- `Bracket.structureRepresentation` JSON (`playoff-bracket-v2`)
- `Match`: `playoffId`, `bracketId`, `bracketPosition` (`SF1`, `SF2`, …)

---

## 6. Acceptance

1. Pure generator unit tests for 2-group and 1-group shapes
2. Generate persists candidate bracket + SF matches with participations
3. Blocked ties / locked playoff / wrong shape rejected
4. `nest build` + `test:playoff` green
