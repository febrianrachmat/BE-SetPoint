# Phase 0.5 — API Validation (Full Tournament Simulation)

| Field | Value |
| --- | --- |
| Document | End-to-end API validation |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Passing |
| Last Updated | 2026-07-28 |

---

## 1. Purpose

Phase 1 delivered the domain engines. Before any UI work starts, the whole chain
is exercised **over HTTP** so that later frontend defects can be attributed to
the frontend instead of suspected backend gates.

This is not a unit-test suite. It is one runnable script that drives real
requests through every gate in order and asserts the outcome.

```text
Tournament -> Category -> Teams -> Drawing -> Schedule -> Match/Scoring
          -> Standing -> Qualification -> Playoff -> Champion
```

---

## 2. How to run

```bash
npm run start:dev          # server must be running
npm run prisma:migrate:deploy
npm run simulate           # both scenarios
npm run simulate -- group  # group_then_knockout only
npm run simulate -- cup    # knockout_only only
```

Script: `scripts/simulate-tournament.ts`. Exit code is non-zero on any failed
assertion, so it can be wired into CI later.

Environment overrides: `SIM_BASE_URL`, `SIM_ADMIN_EMAIL`, `SIM_ADMIN_PASSWORD`.

---

## 3. Scenarios

| Scenario | Config | Shape |
| --- | --- | --- |
| A | `group_then_knockout` | 8 teams, `groupCount=2`, `teamsPerGroup=4`, `qualifyTop=2` |
| B | `knockout_only` | 5 teams with `seedRank` 1..5 → bracket 8 with 3 byes |

Both use scoring template `one_set_4_gp_tb3` to keep the point loop short.

### Determinism

Teams are ranked by registration order and the **stronger team always wins**
every point. A strict total order removes ties, so standings, qualification, and
the champion are predictable and can be asserted rather than merely logged.

---

## 4. What is asserted

**Chain outcomes**

- Drawing: 2 groups × 4 members on the official version
- Schedule: 12 round-robin matches, each with a court assigned
- Standing: 8 rows, 3 matches played each, no unresolved tie flags
- Standing rank order equals team strength; `points === wins` for `pointsForWin=1`
- Qualification: 4 qualified, all ranked 1 or 2
- Playoff (A): 4 qualified seeded into 2 semi-finals, resolved in 3 matches
- Playoff (B): bracket padded to 8, resolved in 4 matches
- Champion is the strongest team, `declarationStatus=declared`
- Tournament reaches `finished` then `archived`

**Gates that must reject (documented rules, verified as HTTP 400)**

| Gate | Rule |
| --- | --- |
| Drawing publish before review approval | REV-02 |
| Schedule generate before Drawing lock | Schedule Ready |
| Match warm-up before tournament go-live | MATCH-05 |
| Match start while `waiting` | MATCH-03 |
| Match finish before `phase=completed` | Step 8B |
| Match verify before `finished` | MATCH-03 |
| Playoff publish before review approval | REV-02 |
| Drawing / Schedule / Standing on `knockout_only` | Competition Mode |
| Duplicate court label in one tournament | 409 conflict |
| Partial court reorder list | Order must stay contiguous |
| Disabling an already disabled court | Idempotency is explicit, not silent |
| Deleting a court a Schedule references | Disable instead |

**Cup integrity**

Final must be contested by seed 1 and seed 2 — the two top seeds may never meet
earlier than the Final.

---

## 5. Findings

### 5.1 Pending migration caused an opaque 500 (fixed by deploy)

`POST .../playoff/generate` returned `500 Internal server error`. Root cause was
an unapplied migration: `brackets.review_outcome` did not exist in the local
database while `schema.prisma` already declared it.

Resolution: `npm run prisma:migrate:deploy`.

Follow-up worth considering: `PrismaClientKnownRequestError` currently surfaces
as a bare 500 with no error code in the envelope, which made diagnosis dependent
on server logs.

### 5.2 Cup seeding placed seeds 1 and 2 in the same half (fixed)

For bracket sizes 8 and 16, `generateKnockoutBracket` paired slot `i` with slot
`size - 1 - i` over a seed-ordered array. First-round pairings were correct
(1v8, 2v7, 3v6, 4v5) but the *positions* were adjacent, so `SF1` became
**seed 1 vs seed 2** and the Final could not feature both top seeds.

Sizes 2 and 4 were unaffected.

Fix: slots are now allocated in standard single-elimination seed order
(size 8 → `[1,8,4,5,2,7,3,6]`) and consecutive pairs form the first round. Byes
still fall to the top seeds because absent seeds occupy the bottom slots.

Because bracket layout semantics changed, the engine version was raised to
`playoff-bracket-v2`. Brackets stored under `playoff-bracket-v1` must be
regenerated; they are rejected rather than reinterpreted.

### 5.3 Court had no HTTP API (closed)

Schedule generation requires at least one available Court (SCH-02), but Court was
only reachable through the database or `prisma/seed.ts`. This was not a bug — it
was a **missing product capability**, and it only became visible by trying to run
the platform the way an organizer would.

Resolution: a Court module with CRUD, `enable` / `disable`, and `reorder`. The
simulation now creates its courts through the API and touches no database
directly, so it validates exactly what a frontend can do.

Two rules came out of implementing it:

- Court mutations stay open while the tournament is `live`, because taking a
  flooded or damaged court out of the pool is an in-event operation. They close
  at `finished` / `archived`.
- A court referenced by a Schedule cannot be deleted, only disabled. History
  must stay explainable.

Ordering needed a new `courts.display_order` column: sorting by label puts
"Court 10" before "Court 2".

---

## 6. Result

| Metric | Value |
| --- | --- |
| Assertions | 47 |
| Gate rejections verified | 14 |
| Matches played | 19 |
| Points scored | 304 |
| HTTP requests | 485 |
| Duration | ~14s |

Both scenarios reach a declared Champion using only the public API. The backend
is considered ready to serve Admin, Referee, and Spectator experiences.
