# API Consumption Guide — Set Point Backend

| Field | Value |
| --- | --- |
| Document | Frontend / client API guide |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Living document |
| Last Updated | 2026-07-29 |
| Companion | `docs/21-system-architecture.md`, Swagger at `/docs` |

---

## 0. How to use this document

This is the **client-facing** map of the backend. Use it when building Admin,
Referee, or Spectator UIs — or when integrating any HTTP client.

| Need | Go to |
| --- | --- |
| Why modules are shaped this way | `docs/21-system-architecture.md` |
| Exact DTO fields / try-it-out | Swagger `http://localhost:3000/docs` |
| Call order and envelopes | **This document** |
| Proof the chain works | `npm run simulate` / `docs/20-api-validation-phase-0-5.md` |

Base URL (local): `http://localhost:3000/api/v1`

---

## 1. Conventions every request shares

### Headers

| Header | Required | Notes |
| --- | --- | --- |
| `Authorization` | Yes (except login + health) | `Bearer <accessToken>` |
| `Content-Type` | On bodies | `application/json` |
| `x-request-id` | Optional | Client may send one; response echoes it (UUID generated if absent) |

### Success envelope

Every successful controller return is wrapped:

```json
{
  "success": true,
  "data": { },
  "meta": {
    "timestamp": "2026-07-29T02:00:00.000Z",
    "path": "/api/v1/tournaments",
    "requestId": "3051f734-6604-47af-af04-2ba79954d39b"
  }
}
```

Frontend rule: always read **`response.data`**, not the raw body root.

### Error envelope

```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "code": "BAD_REQUEST",
    "message": "Schedule generation requires Drawing Published AND Locked (Schedule Ready)",
    "details": { }
  },
  "meta": {
    "timestamp": "2026-07-29T02:00:00.000Z",
    "path": "/api/v1/...",
    "requestId": "..."
  }
}
```

| Field | Meaning |
| --- | --- |
| `error.statusCode` | HTTP status |
| `error.code` | Nest status name (`BAD_REQUEST`, `CONFLICT`, `UNAUTHORIZED`, …) |
| `error.message` | Human-readable; safe to show in toasts for domain gates |
| `error.details` | Optional. Validation → `string[]`. Prisma → `{ prismaCode, model?, target? }` |

Validation failures always use `message: "Validation failed"` with `details` as an
array of field messages (from `ValidationPipe` + `forbidNonWhitelisted`).

### Unauthenticated health check

`GET /api/v1/health` → `{ status, service, database, timestamp }` inside `data`.

---

## 2. Authentication

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "admin@setpoint.local", "password": "Password123!" }
```

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": "8h",
    "user": {
      "id": "...",
      "email": "admin@setpoint.local",
      "displayName": "...",
      "roles": [{ "role": "tournament_admin", "tournamentId": null }]
    }
  },
  "meta": { }
}
```

Failures: `401` `"Invalid email or password"`.

### Current user

```http
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

Returns the same `user` object (reloaded from DB). Use this on app boot to restore session.

### Permissions (what the token can call)

| Permission | Who has it | Controllers |
| --- | --- | --- |
| `tournament:manage` | `super_admin`, `tournament_admin` | Tournament, Category, Team, Player, Court, Drawing, Schedule, Standing, Playoff |
| `match:score` | those + `referee` | Match lifecycle + scoring |
| `platform:manage` | `super_admin` only | (reserved; not on domain modules yet) |

MVP roles are **global** (`tournamentId: null`) — they apply to every tournament.

**Extra rule (not a decorator):** Match **verify** is Admin-only in MVP. A referee
token can warm-up / start / score / finish, but verify returns
`"Only Tournament Admin may Verify matches in MVP (MATCH-10)"`.

### Demo users (after `npm run prisma:seed`)

| Email | Password | Role |
| --- | --- | --- |
| `superadmin@setpoint.local` | `Password123!` | `super_admin` |
| `admin@setpoint.local` | `Password123!` | `tournament_admin` |
| `referee@setpoint.local` | `Password123!` | `referee` |

---

## 3. Call order — the only sequences that work

Engines refuse to skip steps. Treat these flows as the product state machine.

### 3.1 `group_then_knockout` (default)

```text
Login
  → Create Tournament → Create Courts → POST .../setup
  → Create Category (competitionMode=group_then_knockout)
  → Register Teams (+ Players)
  → POST .../publish
  → Drawing:  generate → review(approved) → publish → lock
  → Schedule: generate → review(approved) → publish → lock
  → POST .../go-live
  → For each group match: warm-up → start → score/point… → finish → verify
  → GET standings / standings/qualified
  → Playoff:  generate → review(approved) → publish → lock
  → Play bracket matches (same match lifecycle)
  → GET playoff/champion
  → Tournament finish → archive
```

Key gates (exact messages):

| If you call… | Without… | You get |
| --- | --- | --- |
| Schedule `generate` | Drawing published **and** locked | `400` Schedule Ready |
| Match list / warm-up | Schedule published **and** locked | `400` Live Ready |
| Warm-up | Tournament `live` | `400` MATCH-05 |
| Playoff match ops | Playoff published **and** locked | `400` Playoff Ready |
| `publish` on a version | Review `approved` | `400` REV-02 style |

### 3.2 `knockout_only`

```text
Login
  → Create Tournament → setup
  → Create Category (competitionMode=knockout_only)
  → Register Teams → PATCH seedRank 1..N
  → publish
  → Playoff: generate → review → publish → lock
  → go-live → play bracket → champion → finish → archive
```

Drawing, Schedule, and Standing **recalculate** are rejected with an explicit
competition-mode message — do not hide those screens; show that the category
is cup-only.

Courts are optional for cup play in MVP (playoff matches may run without a court).
They are **required** for Schedule generation in the group path.

---

## 4. Domain endpoints (quick reference)

Full paths are under `/api/v1`. Bodies omit optional fields unless noted.
All listed routes (except auth login / health) need `tournament:manage` except
Match (`match:score`).

### Tournament — `/tournaments`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List (`page`, `pageSize`, `search`, `status`) |
| GET | `/:id` | Detail |
| POST | `/` | Create Draft — `{ name, description?, visibility?, …dates? }` |
| PATCH | `/:id` | Update identity/config (not lifecycle) |
| DELETE | `/:id` | Soft delete (Draft/Setup only) |
| POST | `/:id/setup` | Draft → Setup |
| POST | `/:id/publish` | Setup → Published |
| POST | `/:id/go-live` | Published → Live |
| POST | `/:id/finish` | Live → Finished |
| POST | `/:id/archive` | Finished → Archived |

Lifecycle is **only** via the action endpoints — do not PATCH `status`.

### Category — `/tournaments/:tournamentId/categories`

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/` | List / create |
| GET/PATCH/DELETE | `/:categoryId` | Detail / update / soft delete |

**Create body (group path example):**

```json
{
  "name": "Open Doubles",
  "format": "doubles_group_playoff",
  "configuration": {
    "competitionMode": "group_then_knockout",
    "teamSize": 2,
    "groupCount": 2,
    "teamsPerGroup": 4,
    "scoring": { "templateId": "one_set_4_gp_tb3" },
    "standings": { "pointsForWin": 1, "pointsForLoss": 0, "qualifyTop": 2 }
  }
}
```

**Cup path:** omit group fields; set `"competitionMode": "knockout_only"` and keep
`teamSize` + `scoring`.

### Teams & Players

Base: `/tournaments/:tournamentId/categories/:categoryId/teams`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/` | Register — `{ name, players?: [{ displayName }] }` |
| PATCH | `/:teamId` | `{ name?, seedRank? }` — set `seedRank` for cup |
| POST | `/:teamId/withdraw` | `{ reason }` — keeps history |
| DELETE | `/:teamId` | Soft delete before drawing published/locked |
| * | `/:teamId/players` | Nested player CRUD |

### Courts — `/tournaments/:tournamentId/courts`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List in `displayOrder` (+ `availableCount`); filter `?status=` |
| POST | `/` | `{ name, label, displayOrder?, availabilityNotes? }` |
| PATCH | `/:courtId` | Update fields |
| POST | `/:courtId/enable` | Back to `available` |
| POST | `/:courtId/disable` | `{ status?: "unavailable"\|"maintenance", reason? }` |
| POST | `/reorder` | `{ items: [{ courtId }] }` — **full** ordered list |
| DELETE | `/:courtId` | Soft delete only if no Schedule/Match references |

Mutations stay open while tournament is `live` (operational need). Close at
`finished` / `archived`. Duplicate `label` → `409`.

### Drawing / Schedule / Playoff — shared lifecycle

Pattern for all three artifacts:

```text
POST .../generate
POST .../versions|brackets/:id/review   { "outcome": "approved" | "rejected", "note?" }
POST .../versions|brackets/:id/publish
POST .../lock
POST .../unlock                         { "reason": "..." }   // mandatory, 3–500 chars
```

| Artifact | Base path | Generate body |
| --- | --- | --- |
| Drawing | `.../categories/:categoryId/drawing` | `{ placementMode: "random"\|"seeded", drawingSeed? }` |
| Schedule | `.../categories/:categoryId/schedule` | `{ startAt?, matchDurationMinutes? }` (default 90) |
| Playoff | `.../categories/:categoryId/playoff` | (empty body) |

Also useful GETs: `/`, `/official`, version/bracket lists, and for playoff
`GET .../playoff/champion`.

### Matches — `.../categories/:categoryId/matches`

Permission: `match:score`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List (`status?`, pagination) — needs Live Ready |
| GET | `/:matchId` | Detail + score representation |
| POST | `/:matchId/warm-up` | `waiting` → `warm_up` |
| POST | `/:matchId/start` | `warm_up` → `live` |
| POST | `/:matchId/score/point` | `{ "side": "A" \| "B" }` while `live` |
| POST | `/:matchId/finish` | Requires scoring `phase=completed` |
| POST | `/:matchId/verify` | Admin only → triggers Standing + Playoff reactions |

Scoring template `one_set_4_gp_tb3` (used in simulation) finishes a set quickly —
good for Referee UI smoke tests.

### Standings — `.../categories/:categoryId/standings`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Rows (`?groupId=`) |
| GET | `/qualified` | Playoff intake |
| POST | `/recalculate` | Manual recalc (`?groupId=`) |

Standings also refresh automatically on `match.verified` for group matches.

---

## 5. Worked examples

### 5.1 Login + create tournament

```http
POST /api/v1/auth/login
{ "email": "admin@setpoint.local", "password": "Password123!" }
```

```http
POST /api/v1/tournaments
Authorization: Bearer <token>
{ "name": "Jakarta Open 2026", "visibility": "private" }
```

```http
POST /api/v1/tournaments/{id}/setup
Authorization: Bearer <token>
```

### 5.2 Court create + reorder

```http
POST /api/v1/tournaments/{id}/courts
{ "name": "Center Court", "label": "C1" }
```

```http
POST /api/v1/tournaments/{id}/courts/reorder
{ "items": [{ "courtId": "<uuid-2>" }, { "courtId": "<uuid-1>" }] }
```

Partial reorder lists are rejected (`400`).

### 5.3 Score a point

```http
POST /api/v1/tournaments/{tid}/categories/{cid}/matches/{mid}/score/point
Authorization: Bearer <referee-or-admin-token>
{ "side": "A" }
```

`data` returns the updated match including `scoreRepresentation`.

### 5.4 Typical error (gate)

```http
POST .../schedule/generate
```

before Drawing lock:

```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "code": "BAD_REQUEST",
    "message": "Schedule generation requires Drawing Published AND Locked (Schedule Ready)"
  },
  "meta": { }
}
```

UI should surface `error.message` and optionally deep-link to the Drawing lock
action.

---

## 6. Errors the frontend should handle

### 6.1 Domain / lifecycle (most common)

| Status | When | UI hint |
| --- | --- | --- |
| `400` | Gate, invalid transition, competition-mode block | Show `error.message`; disable the action |
| `401` | Missing/invalid JWT | Re-login |
| `403` | Permission missing | Hide action; role-gated nav |
| `404` | Soft-deleted or wrong tournament scope | Refresh list |
| `409` | Unique name/label (service or Prisma P2002) | Inline field error |

### 6.2 Validation

`400` + `code: BAD_REQUEST` + `message: "Validation failed"` + `details: string[]`.

Render `details` under the form; do not toast the generic message alone.

### 6.3 Prisma mapping (uncaught DB errors)

Uncaught Prisma errors are mapped in `prisma-exception.mapper.ts` so FE does not
see a bare `"Internal server error"` for common constraint failures:

| Prisma code | HTTP | `error.code` | `details` includes |
| --- | --- | --- | --- |
| `P2002` | 409 | `CONFLICT` | `prismaCode`, `target?`, `model?` |
| `P2025` | 404 | `NOT_FOUND` | `prismaCode`, `model?` |
| `P2003` | 400 | `BAD_REQUEST` | `prismaCode`, `field?` |
| `P2014` | 400 | `BAD_REQUEST` | `prismaCode` |
| `P2000` / `P2001` / `P2011` / `P2012` | 400 | `BAD_REQUEST` | `prismaCode` |
| Other known codes | 500 | `INTERNAL_SERVER_ERROR` | **`prismaCode` always present** |
| Validation / init / panic | 400 or 500 | … | `prismaCode` |

Many unique conflicts are still caught in services first (friendlier messages like
`"Court label 'C1' already exists in this tournament"`). The mapper is the
safety net for anything that escapes.

Frontend rule for `500`: if `error.details?.prismaCode` exists, log it and show
a generic “database rejected this change” message — it is still a backend-side
constraint, not a network glitch.

### 6.4 Recommended client helper

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: { timestamp: string; path: string; requestId: string };
};

type ApiError = {
  success: false;
  error: {
    statusCode: number;
    code: string;
    message: string;
    details?: string[] | Record<string, unknown>;
  };
  meta: { timestamp: string; path: string; requestId: string };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as ApiSuccess<T> | ApiError;
  if (!body.success) {
    throw Object.assign(new Error(body.error.message), { api: body.error, meta: body.meta });
  }
  return body.data;
}
```

Keep `meta.requestId` when reporting bugs — it correlates with server logs.

---

## 7. Suggested UI ownership

| Surface | Primary APIs | Auth |
| --- | --- | --- |
| Organizer Dashboard | Tournament → Category → Teams → Courts → Drawing → Schedule → Standing → Playoff | `tournament:manage` |
| Referee Scoring | Match list + warm-up/start/point/finish | `match:score` |
| Admin verify | Match verify (+ optional Standing/Playoff refresh GETs) | Admin role |
| Spectator (later) | Read models; public API not built yet | — |

Vertical slice for first FE milestone: **Login → Tournament list/create → Category → Teams**.
That path has no Drawing dependency and unlocks every later screen.

---

## 8. Where the source of truth lives

| Concern | File |
| --- | --- |
| Prefix, ValidationPipe, Swagger | `src/main.ts` |
| Success envelope | `src/common/interceptors/response-envelope.interceptor.ts` |
| Error envelope + Prisma map | `src/common/filters/http-exception.filter.ts`, `prisma-exception.mapper.ts` |
| Permissions | `src/auth/permissions/permissions.ts` |
| End-to-end happy path | `scripts/simulate-tournament.ts` |

If this guide and Swagger disagree, **trust the running code** and open a doc PR.
