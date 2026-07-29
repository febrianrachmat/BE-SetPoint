# System Architecture — Set Point Backend

| Field | Value |
| --- | --- |
| Document | System architecture overview |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Living document |
| Last Updated | 2026-07-28 |

---

## 0. How to read this document

This is the orientation map for the backend. It explains **how the pieces fit
together**, not how each one is implemented. Detailed specifications live in
`docs/00`–`20`; the client-facing HTTP guide is `docs/22-api-consumption-guide.md`.
This document points at them.

If you have 15 minutes, read sections 2, 3, 4, and 5. Those four cover the
tournament chain, the lifecycle pattern every engine repeats, the readiness
invariants, and the event flow — which is most of the system's behaviour.

---

## 1. Shape of the system

Two repositories, deliberately separate:

| Repository | Owns |
| --- | --- |
| `BE-SetPoint` | Domain APIs, Prisma persistence, architecture docs |
| `FE-SetPoint` | Client applications and organizer-facing experiences |

Backend stack: **NestJS 11** (modular, DI), **Prisma 6** over **PostgreSQL**,
JWT auth with role-based guards, Swagger at `/docs`.

Layering inside a module is consistent:

```text
controller   HTTP surface, DTO validation, permission decorators
   |
service      business rules, gates, lifecycle transitions, event publishing
   |
repository   Prisma access, transactions, include shapes
   |
engine/      pure functions — no DB, no HTTP, unit-testable in isolation
```

The `engine/` folder is the important one. Drawing placement, round-robin
scheduling, padel scoring, standings ranking, and bracket generation are all
**pure** and versioned. They receive plain inputs and return plain plans; the
service decides whether to persist them.

Modules: `auth`, `tournament`, `court`, `category` (with `team`, `player`),
`drawing`, `schedule`, `match` (with `scoring`), `standing`, `playoff`, plus
`common` and `prisma` infrastructure.

---

## 2. The tournament chain

One Category flows through the chain. A Tournament may contain several
Categories, each independently at a different stage.

```text
Registration        Category + Teams + Players, eligibility computed
      |
      v
Drawing             teams partitioned into Groups
      |
      v
Schedule            round-robin Matches + ScheduleEntries on Courts
      |
      v
Match & Scoring     waiting -> warm_up -> live -> finished -> verified
      |
      v
Standing            W-L-P per group, recalculated from verified matches
      |
      v
Qualification       top N per group marked qualified
      |
      v
Playoff             bracket from qualified seeds, advancing on verify
      |
      v
Champion            declared when the Final is verified
```

### Two competition modes

`Category.configuration.competitionMode` selects the path:

| Mode | Path |
| --- | --- |
| `group_then_knockout` (default) | the full chain above |
| `knockout_only` | Registration → Playoff → Champion |

In `knockout_only`, Drawing, Schedule, and Standing are **rejected**, not
skipped silently. The bracket is built from active teams by `seedRank`, padded
to the next power of two, with byes going to the top seeds.

See `docs/19-competition-mode.md`.

---

## 3. The lifecycle pattern every engine repeats

Drawing, Schedule, and Playoff are all versioned artifacts, and all three use
the same five-step lifecycle. Learn it once and you know all three:

```text
Generate      engine produces a candidate version (never official)
    |
    v
Review        Admin approves or rejects the candidate
    |
    v
Publish       approved candidate becomes Official; previous -> historical
    |
    v
Official      exactly one official version per artifact
    |
    v
Lock          freezes upstream edits; unlock demands a written reason
```

Rules that hold across all three:

- The engine **never** auto-publishes. Generation and publication are separate
  human decisions.
- Publish is **not** Lock. They are distinct steps with distinct effects.
- History is preserved. Versions are never rewritten; superseded versions become
  `historical`.
- Unlock requires a `reason` and is recorded.

Match is the exception: it is not a versioned artifact but a state machine
(`waiting → warm_up → live → finished → verified`), with invalid transitions
rejected explicitly.

---

## 4. Readiness invariants

Each stage refuses to start until the previous artifact is both **published and
locked**. These are not database columns; they are assertions in code, which
keeps the rule in one place instead of scattered across callers.

| Invariant | Requires | Guards |
| --- | --- | --- |
| `DrawingService.assertScheduleReady()` | Drawing published ∧ locked | Schedule generation |
| `ScheduleService.assertLiveReady()` | Schedule published ∧ locked | Match listing and lifecycle |
| `PlayoffService.assertPlayoffReady()` | Playoff published ∧ locked + official bracket | Playoff match lifecycle |

Layered on top are tournament-status gates, e.g. Drawing generation needs
`setup` or `published`, warm-up needs `live`, and verify needs `live` plus an
Admin actor.

---

## 5. Domain events

Modules do not call each other to trigger downstream work. They publish events
through a thin in-process publisher (`DOMAIN_EVENT_PUBLISHER`), and interested
modules subscribe. The interface is intentionally minimal so it can be replaced
by a real bus or persisted to `AuditLog` later without touching callers.

```ts
type DomainEvent = { name: string; occurredAt: string; payload: object };
```

### The one chain that is reactive

```text
match.verified            (Match module, on Admin verify)
      |
      +--> Standing module: recalculate the group
      |         |
      |         v
      |    standing.recalculated
      |
      +--> Playoff module: advance the official bracket
                |
                v
           playoff.bracket.advanced
                |
                v
           playoff.champion.declared   (when the Final resolves)
```

Both subscribers are wired in `onModuleInit`. Verify writes no standings and no
bracket rows itself — it extracts the result into the event payload and lets the
owners of those aggregates react. Playoff advancement failures are logged rather
than allowed to fail the verify request.

### Event catalog

| Module | Events |
| --- | --- |
| Tournament | `created`, `updated`, `soft_deleted`, `moved_to_setup`, `published`, `went_live`, `finished`, `archived` |
| Court | `created`, `updated`, `enabled`, `disabled`, `reordered`, `soft_deleted` |
| Category | `created`, `updated`, `soft_deleted` |
| Team | `registered`, `updated`, `soft_deleted`, `withdrawn`, `eligibility_changed` |
| Player | `created`, `updated`, `soft_deleted` |
| Drawing | `ensured`, `version_generated`, `version_reviewed`, `published`, `locked`, `unlocked` |
| Schedule | `ensured`, `version_generated`, `version_reviewed`, `published`, `locked`, `unlocked` |
| Match | `warmed_up`, `started`, `score.updated`, `finished`, `verified` |
| Standing | `recalculated` |
| Playoff | `ensured`, `bracket.generated`, `bracket.reviewed`, `published`, `locked`, `unlocked`, `bracket.advanced`, `champion.declared` |

---

## 6. Versioned engines

Any algorithm whose output is persisted carries a version id, stored alongside
the result. The rule: **never change behaviour under an existing id.** Ship a
new id so historical artifacts remain explainable.

| Engine | Version id | Recorded on |
| --- | --- | --- |
| Drawing placement | `drawing-engine-v1` | `DrawingVersion.engineVersion` |
| Drawing PRNG | `mulberry32-v1` | `DrawingVersion.prngAlgorithm` |
| Schedule generator | `schedule-engine-v1` | `ScheduleVersion.engineVersion` |
| Padel scoring | `padel-scoring-v1` | `Match.scoreRepresentation.engineVersion` |
| Playoff bracket | `playoff-bracket-v2` | `Bracket.structureRepresentation.engineVersion` |

Random drawings store both the seed and the PRNG id, so an official drawing can
be reproduced exactly.

Two caveats worth knowing:

- The bracket reader **rejects** structures from a different engine version
  rather than interpreting them. Bumping to `playoff-bracket-v2` therefore means
  brackets stored under v1 must be regenerated. This preserves honesty at the
  cost of coexistence.
- Standings ranking is **not** versioned. Its behaviour is driven by
  `Category.configuration.standings.tieBreakOrder`, which is stored per
  Category, so the inputs are explicit even though the algorithm is not tagged.

---

## 7. Dependency graph

```text
                    Tournament
                        |
                    Category ----------------------+
                    /   |   \                      |
              Team    Player  configuration        |
                |                                  |
             Drawing (Groups, GroupMembers)        |
                |                                  |
             Schedule (Matches, ScheduleEntries)   |
                |          \                       |
              Match  <----- Court                  |
                |                                  |
             Standing                              |
                |                                  |
            Qualification                          |
                |                                  |
             Playoff (Brackets, Matches) <---------+  knockout_only
                |                                     enters here
             Champion
```

Courts belong to the Tournament and are consumed by Schedule and Match. Schedule
generation draws from `available` courts in `displayOrder`, so court availability
is an operational lever an organizer can pull mid-event. Playoff matches may run
without a court in the MVP.

---

## 8. Data model orientation

Full physical design is in `docs/08-physical-database-design.md`. The shape you
need to navigate the code:

| Concern | Tables |
| --- | --- |
| Foundation | `tournaments`, `courts`, `sponsors`, `galleries`, `gallery_items` |
| Registration | `categories`, `teams`, `players` |
| Drawing | `drawings`, `drawing_versions`, `groups`, `group_members` |
| Schedule | `schedules`, `schedule_versions`, `schedule_entries` |
| Play | `matches`, `match_participations`, `referee_assignments` |
| Results | `standings`, `playoffs`, `brackets`, `champions` |
| Governance | `reviews`, `audit_logs`, `event_logs` |
| Identity | `users`, `user_role_assignments` |

Recurring column profiles: audit (`createdAt/By`, `updatedAt/By`), soft delete
(`deletedAt/By`), publish (`publishState`, `publishedAt/By`), lock (`lockState`,
`lockedAt/By`, `unlockReason`), and `rowVersion` for optimistic concurrency.

---

## 9. Authentication and authorization

JWT bearer tokens. Roles are assigned in `user_role_assignments` with an
optional `tournamentId`, so per-tournament roles are possible; the MVP seeds
global roles only.

| Permission | Roles |
| --- | --- |
| `tournament:manage` | `super_admin`, `tournament_admin` |
| `match:score` | `super_admin`, `tournament_admin`, `referee` |

A referee may only score matches they are assigned to. Match verification is
Admin-only in the MVP.

API conventions: prefix `/api/v1`, success envelope
`{ success, data, meta }`, error envelope `{ success, error, meta }`, request
correlation via `x-request-id`, and a global ValidationPipe with
`whitelist` + `forbidNonWhitelisted`.

---

## 10. How the system is validated

Two layers, deliberately different in kind:

**Engine unit checks** — pure functions, no server or database. Fast, run per
module: `npm run test:drawing | test:schedule | test:match | test:scoring |
test:standing | test:playoff`.

**Full tournament simulation** — one script driving Registration → Champion over
HTTP for both competition modes, asserting outcomes *and* verifying that
documented gates reject invalid calls: `npm run simulate`.

The second layer earns its place: it found a bracket seeding defect that the
unit tests had encoded as expected behaviour, and it exposed a missing product
capability — no Court API — which has since been built. The simulation now
touches no database directly, so it validates exactly what a frontend can do.
See `docs/20-api-validation-phase-0-5.md`.

---

## 11. Known gaps

| Gap | Impact |
| --- | --- |
| Standing publish/lock not exposed | Standings have the columns but no lifecycle endpoints |
| Playoff matches have no court assignment | Acceptable for MVP, visible in an ops UI |
| `random_draw` tie-break is manual | Marks `random_draw_pending`; never auto-shuffles by design |
| `AuditLog` not written | Events are published and logged, not persisted |

---

## 12. Where to look in the code

| Question | File |
| --- | --- |
| Bootstrap, envelope, Swagger | `src/main.ts` |
| Prisma → HTTP error mapping | `src/common/filters/prisma-exception.mapper.ts` |
| Event contract | `src/common/events/domain-event.publisher.ts` |
| Tournament lifecycle rules | `src/tournament/tournament.lifecycle.ts` |
| Court availability rules | `src/court/court.rules.ts` |
| Competition mode resolution | `src/category/competition-mode.ts` |
| Drawing placement + PRNG | `src/drawing/engine/` |
| Round-robin + court allocation | `src/schedule/engine/` |
| Padel scoring rules and templates | `src/match/scoring/` |
| Ranking, tie-break, qualification | `src/standing/engine/` |
| Bracket generation and advancement | `src/playoff/engine/` |
| End-to-end simulation | `scripts/simulate-tournament.ts` |

---

## 13. Document index

| Doc | Topic |
| --- | --- |
| `00`–`05` | Charter, glossary, domain model, business rules, engine spec, SRS |
| `06`–`09` | Conceptual model, logical ERD, physical design, Prisma spec |
| `10` | Drawing engine (6A–6C) |
| `11`–`12` | Scoring engine (8B), match verification (8C) |
| `13`–`15` | Standing engine, tie-break, qualification (9A–9C) |
| `16`–`18` | Playoff bracket, versioning, progression (10A–10C) |
| `19` | Competition mode |
| `20` | Phase 0.5 API validation |
| `21` | System architecture (for humans) |
| `22` | API consumption guide (for FE / clients) |
