# Set Point — Backend (BE-SetPoint)

Backend repository for the **Set Point** padel tournament platform.

**Set Point** is a production-grade SaaS platform that helps Event Organizers manage padel tournaments from preparation to champion declaration through intelligent automation while keeping humans fully in control.

## Vision

To become the trusted operating system for padel tournament management—where Event Organizers can run professional competitions with confidence, speed, and full control.

## Repository Role

This repository (`BE-SetPoint`) owns platform services, domain APIs, Prisma persistence, and architecture documentation.

Companion repository:

- Frontend: [FE-SetPoint](https://github.com/febrianrachmat/FE-SetPoint)

## Repository Structure

```text
BE-SetPoint/
├── docs/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── common/              # API foundation (filters, interceptors, middleware)
│   ├── prisma/
│   ├── app.controller.ts    # GET /api/v1/health
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts
├── nest-cli.json
└── package.json
```

## Quick start

```bash
npm install
cp .env.example .env   # set DATABASE_URL
npm run prisma:generate
npm run prisma:seed
npm run start:dev
```

- Health: `GET http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/docs`

## API foundation

All business endpoints should follow:

- Prefix: `/api/v1`
- Success envelope: `{ success: true, data, meta }`
- Error envelope: `{ success: false, error, meta }`
- ValidationPipe (whitelist + transform)
- Request id via `x-request-id`
- HTTP request logging

## Prisma

```bash
npm run prisma:validate
npm run prisma:migrate:deploy
npm run prisma:seed
```

## Development Status

**Phase:** Implementation kickoff

Done:

- Architecture docs 00–09
- Prisma schema (26 tables)
- NestJS foundation + Prisma wiring
- Baseline migration + demo seed
- API foundation (Swagger, envelope, filters, logging, `/api/v1`)
- Auth foundation (User + role assignments, JWT, RBAC-ready guards)
- Tournament module (CRUD + official lifecycle transitions)
- Thin DomainEventPublisher (log-only MVP; ready for AuditLog later)
- Category → Team → Player module (registration, eligibility, soft delete, withdraw)
- **Step 6A** — Drawing Generation (candidate versions, Groups, GroupMembers; no Match/Publish/Lock)
- **Step 6B** — Drawing Versioning (Review → Publish → Official; history preserved)
- **Step 6C** — Drawing Lock (freeze registration / withdraw / category structure)
- **Step 7** — Schedule Generation (RR matches + ScheduleEntry from Official Locked Drawing)
- **Step 7B** — Schedule Versioning (Review → Publish → Official)
- **Step 7C** — Schedule Lock (+ Live Ready gate for Step 8)
- **Step 8A** — Match Lifecycle (waiting → warm_up → live → finished → verified)
- **Step 8B** — Scoring Engine (pure padel point/game/set; finish gated on completed score)
- **Step 8C** — Match Verification (gates + `getMatchResult` + `match.verified` for Standing)
- **Step 9A** — Standing Engine (group W-L-P + rank from Verified; auto on `match.verified`)
- **Step 9B** — Tie-break policy pipeline (`tieBreakOrder`, H2H mini-table; no silent random)
- **Step 9C** — Qualification (`qualifyTop` → `qualificationStatus` for Playoff intake)
- **Step 10A** — Playoff Bracket Generator (candidate Bracket from qualified seeds)
- **Step 10B** — Playoff Review → Publish → Official → Lock (Playoff Ready)
- **Step 10C** — Playoff progression + Champion (auto on verify)
- **Competition Mode** — `group_then_knockout` | `knockout_only` per Category

Domain engines through Playoff are complete for MVP group → knockout **and** direct cup.

Next (optional polish):

1. Standing Publish/Lock UX
2. Court assignment for playoff matches
3. Contested tie Admin resolution UI

## Tournament API

All routes require Bearer auth + `tournament:manage` permission.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/tournaments` | search, status filter, pagination |
| GET | `/api/v1/tournaments/:id` | detail |
| POST | `/api/v1/tournaments` | create as Draft |
| PATCH | `/api/v1/tournaments/:id` | update fields (not free status change) |
| DELETE | `/api/v1/tournaments/:id` | soft delete (Draft/Setup only) |
| POST | `/api/v1/tournaments/:id/setup` | Draft → Setup |
| POST | `/api/v1/tournaments/:id/publish` | Setup → Published (requires ≥1 Category) |
| POST | `/api/v1/tournaments/:id/go-live` | Published → Live |
| POST | `/api/v1/tournaments/:id/finish` | Live → Finished |
| POST | `/api/v1/tournaments/:id/archive` | Finished → Archived |

## Category / Team / Player API

Nested under tournament. Same auth as Tournament (`tournament:manage`). Param `tournamentId` enables scoped RBAC.

### Categories — `/api/v1/tournaments/:tournamentId/categories`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | list + search + pagination |
| GET | `/:categoryId` | detail |
| POST | `/` | create (Draft/Setup/Published) |
| PATCH | `/:categoryId` | update when unlocked; blocks if published/locked artifacts |
| DELETE | `/:categoryId` | soft delete (CAT-05: no verified matches / published artifacts) |

`configuration.competitionMode` (required conceptually; defaulted on write):

| Value | Meaning |
| --- | --- |
| `group_then_knockout` | Drawing → Schedule → Standing → Playoff (default) |
| `knockout_only` | Skip Drawing/Schedule/Standing; Playoff from active teams (2–16, byes when needed) |

### Teams — `.../categories/:categoryId/teams`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | list (+ players) |
| GET | `/:teamId` | detail |
| POST | `/` | register team; optional `players[]`; recomputes eligibility |
| PATCH | `/:teamId` | rename before Drawing published/locked |
| DELETE | `/:teamId` | soft delete before Drawing published/locked (TEAM-06) |
| POST | `/:teamId/withdraw` | withdraw with reason (TEAM-07) |

### Players — `.../teams/:teamId/players`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | list |
| GET | `/:playerId` | detail |
| POST | `/` | add player; duplicate name in category rejected (TEAM-05) |
| PATCH | `/:playerId` | rename |
| DELETE | `/:playerId` | soft delete; eligibility recomputed |

Eligibility: `configuration.teamSize` vs active players → `eligible` / `ineligible`.

## Drawing API (Step 6A + 6B)

Design: `docs/10-drawing-engine-step-6a.md`

Base: `/api/v1/tournaments/:tournamentId/categories/:categoryId/drawing`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Drawing header (+ official version summary) |
| GET | `/official` | Current official version detail |
| POST | `/generate` | New **candidate** version + Groups + GroupMembers |
| GET | `/versions` | Version history |
| GET | `/versions/:versionId` | Version detail |
| POST | `/versions/:versionId/review` | Approve/reject candidate (REV) |
| POST | `/versions/:versionId/publish` | Make official (requires approved review) |
| POST | `/lock` | Lock published Drawing (freezes registration/withdraw/category) |
| POST | `/unlock` | Exceptional unlock — body `{ "reason": "..." }` |

`POST /generate` body: `{ "placementMode": "random" \| "seeded", "drawingSeed?": "..." }`

`POST .../review` body: `{ "outcome": "approved" \| "rejected", "note?": "..." }`

Flow: **Generate → Review(approve) → Publish(official) → Lock**. Prior official becomes `historical`. Unlock requires reason (LOCK-07).

Lock effects (6C):
- No generate / review / publish
- No team register / soft-delete (also blocked after Publish)
- No team withdraw
- Category structure delete/update blocked; Category + official Groups lockState set

**Schedule Ready** (conceptual, not a DB field): Schedule Generation (Step 7) requires Drawing **Published AND Locked**. Helper: `DrawingService.assertScheduleReady()`.

Step 7 API: `POST .../schedule/generate` — **no** `drawingVersionId` in the body; engine always uses the Official version.

- Eligible teams only; exact partition via `configuration.groupCount` × `teamsPerGroup`
- Stores `drawingSeed`, `prngAlgorithm` (`mulberry32-v1` for random), `engineVersion`, `generationDurationMs`
- Does **not** create Matches; Publish does **not** Lock
- Unit checks: `npm run test:drawing`

## Schedule API (Step 7 / 7B / 7C)

Base: `/api/v1/tournaments/:tournamentId/categories/:categoryId/schedule`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Schedule header |
| GET | `/official` | Current official version detail |
| POST | `/generate` | Candidate version + Matches + ScheduleEntries |
| GET | `/versions` | History |
| GET | `/versions/:versionId` | Detail with entries/matches |
| POST | `/versions/:versionId/review` | Approve/reject candidate |
| POST | `/versions/:versionId/publish` | Make official (requires approved review) |
| POST | `/lock` | Lock published Schedule |
| POST | `/unlock` | Exceptional unlock — `{ "reason": "..." }` |

`POST /generate` optional body: `{ "startAt?", "matchDurationMinutes?" }` — **never** `drawingVersionId`.

Flow: **Generate → Review(approve) → Publish(official) → Lock**.

- Requires Schedule Ready (Drawing Published ∧ Locked)
- Conflicts block approve/publish path when `conflictStatus=conflict`
- **Live Ready** (for Step 8): Schedule Published ∧ Locked — `ScheduleService.assertLiveReady()`
- Unit: `npm run test:schedule`

## Match API (Step 8A / 8B / 8C)

Base: `/api/v1/tournaments/:tournamentId/categories/:categoryId/matches`

Auth: `match:score` (tournament_admin + referee; referee only on assigned matches).  
**Verify** is Admin-only in MVP.

Requires **Live Ready** Schedule. Only Official schedule version matches.

| Method | Path | Transition |
| --- | --- | --- |
| GET | `/` | list (+ status filter) |
| GET | `/:matchId` | detail |
| POST | `/:matchId/warm-up` | waiting → warm_up (Tournament must be Live) |
| POST | `/:matchId/start` | warm_up → live (snapshots scoring config) |
| POST | `/:matchId/score/point` | apply point `{ "side": "A"\|"B" }` while live |
| POST | `/:matchId/finish` | live → finished (requires completed score) |
| POST | `/:matchId/verify` | finished → verified (Admin; Tournament Live; emits `match.verified`) |

Invariants:
- One occupying Match per Court (`warm_up` / `live`)
- Scoring config from `Category.configuration.scoring` (template + overrides); snapshot at `start`
- Verify extracts `getMatchResult` into event payload (`result` + `sides` + `groupId`) — **does not** write Standings
- Standing module consumes `match.verified` (in-process) and recalculates the group
- Unit: `npm run test:match`, `npm run test:scoring`

## Standing API (Step 9A)

Base: `/api/v1/tournaments/:tournamentId/categories/:categoryId/standings`

Auth: `tournament:manage`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | List (+ optional `groupId`) |
| GET | `/qualified` | Qualified teams only (Step 9C → Playoff intake) |
| POST | `/recalculate` | Body `{ "groupId?" }` — Verified matches only |

- Criteria: `Category.configuration.standings` (`pointsForWin` / `pointsForLoss` / `tieBreakOrder` / `qualifyTop`)
- Default tie-break: points → wins → head_to_head → set diff → game diff
- `random_draw` in order marks `random_draw_pending` (Admin); never auto-shuffles
- Qualification: top `qualifyTop` per group; ambiguous cutoff → `qualification_blocked_tie`
- Unit: `npm run test:standing`

## Playoff API (Step 10A)

Base: `/api/v1/tournaments/:tournamentId/categories/:categoryId/playoff`

Auth: `tournament:manage`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Playoff header |
| GET | `/official` | Current official Bracket |
| POST | `/generate` | Candidate Bracket from qualified standings |
| GET | `/brackets` | Version history |
| GET | `/brackets/:bracketId` | Detail + matches |
| POST | `/brackets/:bracketId/review` | `{ outcome: approved\|rejected, note? }` |
| POST | `/brackets/:bracketId/publish` | Make Official (requires approved) |
| POST | `/lock` | Lock Published Playoff |
| POST | `/unlock` | `{ reason }` mandatory |
| GET | `/champion` | Declared Champion (after Final verified) |

- Intake: Standing `qualified` **or** active teams when `competitionMode=knockout_only`
- MVP pairing group path: A1vsB2 / B1vsA2; cup path: seeded 1vsN, bracket = next power of 2 (2–16) with byes
- Blocks: Drawing/Schedule/Standing rejected for `knockout_only`
- **Playoff Ready**: Published ∧ Locked — `PlayoffService.assertPlayoffReady()`
- On playoff match verify: advance dependent bracket slots; declare Champion when Final completes
- Unit: `npm run test:playoff`

## Auth

```bash
# ensure JWT_SECRET is set in .env
npm run prisma:seed
npm run start:dev
```

Demo users (password `Password123!`):

| Email | Global role |
| --- | --- |
| `superadmin@setpoint.local` | `super_admin` |
| `admin@setpoint.local` | `tournament_admin` |
| `referee@setpoint.local` | `referee` |

Endpoints:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me` (Bearer token)

Role assignments support optional `tournamentId` for future per-tournament roles. MVP seeds global roles (`tournamentId = null`).

## License

MIT — see [LICENSE](./LICENSE).
