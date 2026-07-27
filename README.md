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

Next:

1. Drawing / Schedule / Match layers
2. Live Scoring → Standing → Playoff

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
