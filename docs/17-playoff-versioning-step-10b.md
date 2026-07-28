# Step 10B — Playoff Versioning & Lock

| Field | Value |
| --- | --- |
| Document | Playoff Review / Publish / Lock — Step 10B |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Implemented |
| Last Updated | 2026-07-28 |
| Depends On | Playoff Bracket Generator 10A |
| Out of Scope | Match progression / Champion (10C) |

---

## 1. Pattern

Mirror Drawing / Schedule:

```text
Generate (candidate Bracket)
  → Review (approve|reject)
  → Publish (Official)
  → Lock (Playoff Ready)
```

- **Playoff** = header (publish/lock + `currentOfficialBracketId`)
- **Bracket** = version (`candidate` → `official` → `historical`, `reviewOutcome`)

---

## 2. API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/official` | Current official bracket |
| POST | `/brackets/:id/review` | `{ outcome, note? }` |
| POST | `/brackets/:id/publish` | Requires approved |
| POST | `/lock` | Requires published + official |
| POST | `/unlock` | `{ reason }` mandatory |

---

## 3. Gates

- Review/Publish forbidden when Playoff Locked
- Publish requires `reviewOutcome=approved`, tournament `live`
- Lock requires Published + Official bracket
- Generate already blocks when Locked

---

## 4. Playoff Ready

`assertPlayoffReady()` = Published ∧ Locked ∧ Official bracket — gate for Step 10C.

---

## 5. Schema

Added `Bracket.reviewOutcome` (`review_status` enum) via migration `20260728140000_bracket_review_outcome`.
