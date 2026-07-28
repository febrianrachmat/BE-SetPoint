# Step 8C — Match Verification

| Field | Value |
| --- | --- |
| Document | Match Verification — Step 8C |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Implemented |
| Last Updated | 2026-07-28 |
| Depends On | Match Lifecycle 8A, Scoring Engine 8B |
| Out of Scope | Standing recalc (Step 9), referee verify policy, walkover/retired UX |

---

## 1. Purpose

Make **Verified** the only official Match outcome that downstream engines may consume.

```text
Finished → Verify → match.verified → (Standing consumer in Step 9)
```

`MatchService` does **not** update Standings.

---

## 2. Endpoint

```http
POST /api/v1/tournaments/:tournamentId/categories/:categoryId/matches/:matchId/verify
```

Permission: `match:score` + **Admin only** in MVP (`super_admin` / `tournament_admin`).  
Referee verify policy is deferred.

---

## 3. Gates (all required)

| Gate | Rule |
| --- | --- |
| Transition | Current status must be `finished` → `verified` |
| Actor | Tournament Admin / Super Admin |
| Tournament | Status `live` (MVP; may relax later for post-event backlog) |
| Schedule | Official Locked Schedule (Live Ready) |
| Score | `scoreRepresentation` completed (`isMatchComplete`) |
| Idempotency | Already `verified` → illegal transition |

---

## 4. Result extraction

Pure scoring helper (no Nest/Prisma):

```ts
getMatchResult(state): {
  winnerSide: 'A' | 'B'
  loserSide: 'A' | 'B'
  setsWon: { A: number; B: number }
  sets: Array<[number, number]>  // games per completed set
}
```

Team IDs are attached at Nest boundary from `MatchParticipation.sideLabel`.

---

## 5. Event contract

`match.verified` payload includes:

- standard match transition fields (`matchId`, statuses, `scheduleVersionId`, `actorId`, …)
- `result` — output of `getMatchResult`
- `sides` — `{ A: teamId | null, B: teamId | null }`
- `groupId` — group-stage context for Standing auto-recalc

Standing Engine (Step 9) listens / polls this contract. Event publisher may still be log-only stub.

---

## 6. Explicit non-goals

- No `StandingService` call from `MatchService.verify`
- No ranking / tie-break / qualification here
- No score edits during verify (score was finalized at Finish)

---

## 7. Acceptance

1. Verify rejected unless Admin + Live tournament + completed score + finished status + official schedule
2. `getMatchResult` unit-tested; incomplete state throws
3. `match.verified` payload carries `result` + `sides`
4. `nest build` + `npm run test:scoring` green
