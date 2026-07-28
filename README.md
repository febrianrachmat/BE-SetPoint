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

Next:

1. Step 7 — Schedule Generation (Match + ScheduleEntry)
2. Step 8+ — Live Match → Standing → Playoff

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
