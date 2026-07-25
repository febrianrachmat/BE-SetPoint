# Prisma Schema Specification

| Field | Value |
| --- | --- |
| Document | Prisma Schema Specification |
| Product | Set Point |
| Version | 0.1.1 |
| Status | Implementation Specification Phase |
| Classification | Internal — Prisma Implementation Blueprint |
| Last Updated | 2026-07-25 |
| ORM | Prisma ORM |
| Database | PostgreSQL 17+ |
| Depends On | `00-project-charter.md` … `08-physical-database-design.md` |

---

## 1. Purpose

This document is the authoritative blueprint for generating `schema.prisma`.

It translates the approved Physical Database Design into Prisma mapping rules, constraints, and generation standards.

It is **not** `schema.prisma`.  
It does **not** contain migrations.  
It does **not** redefine business meaning.

**Priority**

```text
Physical Database Design
↓
Logical ERD
↓
Conceptual Data Model
↓
Business Rules
```

When Prisma capabilities differ from PostgreSQL, Physical Database Design remains authoritative (see Unsupported PostgreSQL Features).

---

## 2. Scope

In scope:

- Prisma configuration and generator/datasource strategy
- Model, enum, field, relation, constraint, and index mapping
- Soft delete, audit, versioning, and JSON mapping rules
- Naming conventions and generation rules
- Migration/seed strategy at specification level
- Validation checklist for schema generation

Out of scope:

- Actual `schema.prisma` file content generation in this task
- SQL migration files
- Application repository code
- NestJS/Next.js module implementation

---

## 3. Prisma Design Principles

1. **Physical Design First** — Prisma models mirror documented tables exactly.
2. **One Model Per Table** — No combined or split models unless Physical Design changes.
3. **Explicit Mapping** — Always use `@@map` / `@map` to preserve plural snake_case tables and snake_case columns.
4. **Singular Model Names** — Prisma models are PascalCase singular.
5. **Relations for Every FK** — Every foreign key has a typed `@relation`.
6. **Enums for Every PG Enum** — No stringly-typed status fields where enums are defined.
7. **Integrity Preservation** — Documented constraints must exist in Prisma and/or SQL migration.
8. **No Business Redesign** — Naming and structure follow Glossary / Physical Design.
9. **Optimistic Concurrency Ready** — Map `row_version` where defined.
10. **Document Deviations** — Any Prisma limitation workaround must be documented before merge.

---

## 4. Prisma Configuration

| Setting | Decision |
| --- | --- |
| Schema file | `prisma/schema.prisma` (to be generated later from this spec) |
| Multi-file schema | Not required for V1 |
| Preview features | Use only if required for documented PostgreSQL features; justify in PR |
| Client output | Default Prisma Client generation for NestJS backend |
| Binary targets | Align with deployment runtime when generating later |

---

## 5. Datasource Strategy

| Item | Decision |
| --- | --- |
| Provider | `postgresql` |
| URL | Environment variable `DATABASE_URL` |
| Shadow database | Use Prisma migrate shadow DB in CI/local as needed |
| Connection pooling | Application/infra concern (e.g. PgBouncer); not modeled in schema |
| Schema | `public` |

Datasource must point only to the Set Point PostgreSQL database defined by Physical Database Design.

---

## 6. Generator Strategy

| Item | Decision |
| --- | --- |
| Generator | `prisma-client-js` |
| Purpose | Typed client for NestJS backend |
| Additional generators | None in V1 unless approved |
| Generation trigger | After schema.prisma is created/updated from this specification |

Frontend (Next.js) consumes APIs; it does not own Prisma schema generation in V1.

---

## 7. Model Mapping

Physical tables map to singular Prisma models. Do **not** generate model bodies here—mapping only.

| Physical Table | Prisma Model | `@@map` |
| --- | --- | --- |
| tournaments | Tournament | tournaments |
| categories | Category | categories |
| courts | Court | courts |
| teams | Team | teams |
| players | Player | players |
| drawings | Drawing | drawings |
| drawing_versions | DrawingVersion | drawing_versions |
| groups | Group | groups |
| group_members | GroupMember | group_members |
| schedules | Schedule | schedules |
| schedule_versions | ScheduleVersion | schedule_versions |
| schedule_entries | ScheduleEntry | schedule_entries |
| matches | Match | matches |
| match_participations | MatchParticipation | match_participations |
| standings | Standing | standings |
| playoffs | Playoff | playoffs |
| brackets | Bracket | brackets |
| champions | Champion | champions |
| sponsors | Sponsor | sponsors |
| galleries | Gallery | galleries |
| gallery_items | GalleryItem | gallery_items |
| reviews | Review | reviews |
| audit_logs | AuditLog | audit_logs |
| event_logs | EventLog | event_logs |
| referee_assignments | RefereeAssignment | referee_assignments |

**Total models: 26** (one per physical table).

Note: `Group` is a reserved-ish name in some languages; Prisma model `Group` with `@@map("groups")` is required by Physical Design.

---

## 8. Enum Mapping

| PostgreSQL Enum | Prisma Enum Name | Values (Prisma identifiers) | Notes |
| --- | --- | --- | --- |
| tournament_status | TournamentStatus | draft, setup, published, live, finished, archived | Map DB values with `@map` if casing differs |
| match_status | MatchStatus | waiting, warm_up, live, finished, verified | |
| version_status | VersionStatus | candidate, official, historical | |
| publish_state | PublishState | unpublished, published | |
| lock_state | LockState | unlocked, locked | |
| review_status | ReviewStatus | pending, approved, rejected | |
| visibility | Visibility | private, public | |
| court_status | CourtStatus | available, unavailable, maintenance | |
| team_status | TeamStatus | active, withdrawn | |
| player_status | PlayerStatus | active, replaced, inactive | |
| eligibility_status | EligibilityStatus | eligible, ineligible | |
| qualification_status | QualificationStatus | qualified, not_qualified | |
| result_status | ResultStatus | pending, normal, cancelled, abandoned, corrected | |
| assignment_status | AssignmentStatus | active, inactive | |
| conflict_status | ConflictStatus | unknown, clear, conflict | |
| declaration_status | DeclarationStatus | declared | |
| artifact_type | ArtifactType | drawing, schedule, playoff, bracket | |

**Total enums: 17**

Prisma enum member names should be stable identifiers; use `@map("warm_up")` style only if Prisma identifier cannot match DB value directly.

---

## 9. Field Mapping

### Type mapping

| PostgreSQL Type | Prisma Field Type | Attribute |
| --- | --- | --- |
| UUID | String | `@db.Uuid` |
| TIMESTAMPTZ | DateTime | `@db.Timestamptz(6)` (or project-standard precision) |
| TIMESTAMP | DateTime | Avoid; prefer Timestamptz |
| BOOLEAN | Boolean | — |
| TEXT | String | — |
| VARCHAR(n) | String | `@db.VarChar(n)` |
| INTEGER | Int | — |
| JSONB | Json | `@db.JsonB` |
| ENUM | corresponding Prisma enum | — |

### Identity and defaults

| Physical Pattern | Prisma Mapping Rule |
| --- | --- |
| `id UUID PK DEFAULT gen_random_uuid()` | `id String @id @default(uuid()) @db.Uuid` **or** DB-default via `@default(dbgenerated("gen_random_uuid()")) @db.Uuid` — choose one strategy project-wide and keep consistent with migrations |
| `created_at TIMESTAMPTZ DEFAULT now()` | `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(...)` |
| `updated_at` | `updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(...)` (or explicit app updates if `@updatedAt` insufficient) |
| `row_version INTEGER DEFAULT 1` | `rowVersion Int @default(1) @map("row_version")` |
| Nullable UUID actor fields | `String? @db.Uuid` |

### Column naming

- Prisma fields: camelCase
- Physical columns: snake_case via `@map("snake_case")`
- Never rename physical columns to match Prisma aesthetics

### Field coverage rule

Every column in Physical Database Design Section 8 must appear on its Prisma model (including audit, soft delete, publish, lock, and version profile columns).

---

## 10. Relation Mapping

### Relation styles

| Style | When | Prisma Pattern |
| --- | --- | --- |
| One-to-Many | Parent owns many children | Parent has `Child[]`; Child has required/optional parent FK + relation |
| One-to-One | Unique FK on child (e.g. gallery per tournament, drawing per category) | Parent optional `Child?`; Child required unique FK |
| Many-to-Many | Explicit associative table only | Model the join entity (`GroupMember`, `MatchParticipation`); no implicit `@@relation` M2M shortcuts that hide the join table |
| Optional FK | Nullable FK column | `parentId String?` + optional relation |
| Required FK | NOT NULL FK | required scalar + required relation |
| Self relation | None in V1 | N/A |

### Named relations (required where multiple paths exist)

Multiple FKs between the same model pair need explicit relation names.

Critical cases:

| Child Model | FK Fields | Parent | Relation Name Guidance |
| --- | --- | --- | --- |
| Drawing | currentOfficialVersionId | DrawingVersion | `DrawingOfficialVersion` vs `DrawingVersionHistory` |
| Schedule | currentOfficialVersionId | ScheduleVersion | `ScheduleOfficialVersion` vs `ScheduleVersionHistory` |
| Playoff | currentOfficialBracketId | Bracket | `PlayoffOfficialBracket` vs `PlayoffBracketHistory` |
| Match | categoryId, groupId, playoffId, bracketId, courtId, scheduleVersionId | multiple | Distinct relation names per FK |
| Champion | playoffId, categoryId, winningTeamId | Playoff, Category, Team | Distinct names |
| Standing | categoryId, groupId, teamId | Category, Group, Team | Distinct names |

### Ownership-aligned relation examples (mapping only)

| Parent | Children (1:N unless noted) |
| --- | --- |
| Tournament | Category[], Court[], Sponsor[], Gallery? (1:1), AuditLog[], EventLog[] |
| Category | Team[], Drawing? (1:1), Schedule? (1:1), Group[], Match[], Standing[], Playoff? (1:1) |
| Team | Player[], GroupMember[], MatchParticipation[], Standing[] |
| Drawing | DrawingVersion[] |
| DrawingVersion | Group[], GroupMember[] |
| Schedule | ScheduleVersion[] |
| ScheduleVersion | ScheduleEntry[] |
| Match | MatchParticipation[], RefereeAssignment[] |
| Playoff | Bracket[], Match[], Champion? (1:1) |
| Gallery | GalleryItem[] |

---

## 11. Constraint Mapping

| Physical Constraint Type | Prisma Support | Mapping Rule |
| --- | --- | --- |
| Primary Key | Supported | `@id` |
| Foreign Key | Supported | relation + FK scalar |
| Simple Unique | Supported | `@unique` / `@@unique` |
| Composite Unique | Supported | `@@unique([a, b, ...])` |
| Partial Unique | **Not fully declarative** | SQL migration (Section 13) |
| Check Constraint | **Not fully declarative** | SQL migration (Section 13) |
| Default values | Supported (subset) | `@default(...)` or `dbgenerated` |

### Declarative uniques to map in Prisma

| Constraint | Prisma Target |
| --- | --- |
| uq_drawings_category | `Drawing.categoryId @unique` |
| uq_schedules_category | `Schedule.categoryId @unique` |
| uq_playoffs_category | `Playoff.categoryId @unique` |
| uq_galleries_tournament | `Gallery.tournamentId @unique` |
| uq_champions_playoff | `Champion.playoffId @unique` |
| uq_drawing_versions_number | `@@unique([drawingId, versionNumber])` |
| uq_schedule_versions_number | `@@unique([scheduleId, versionNumber])` |
| uq_brackets_playoff_number | `@@unique([playoffId, versionNumber])` |
| uq_groups_version_name | `@@unique([drawingVersionId, name])` |
| uq_group_members_group_team | `@@unique([groupId, teamId])` |
| uq_schedule_entries_version_match | `@@unique([scheduleVersionId, matchId])` |
| uq_match_participations_match_side | `@@unique([matchId, sideLabel])` |
| uq_match_participations_match_team | `@@unique([matchId, teamId])` |
| uq_standings_category_team_group | `@@unique([categoryId, teamId, groupId])` — confirm NULL group semantics with PostgreSQL unique NULL behavior; if needed use SQL partial/coalesced unique |

### Soft-delete-aware uniques

`uq_tournaments_name_active`, `uq_categories_tournament_name`, `uq_courts_tournament_label`, `uq_teams_category_name` require partial unique indexes via SQL migration.

---

## 12. Index Mapping

| Physical Index | Prisma Mapping |
| --- | --- |
| PK | `@id` |
| Non-unique btree indexes | `@@index([fields], map: "idx_...")` |
| Composite indexes | `@@index([a, b], map: "idx_...")` |
| Descending time indexes | Prefer SQL migration if Prisma cannot express DESC exactly as documented |
| Partial indexes | SQL migration |

### Indexes to declare in Prisma (representative)

- `@@index([tournamentId], map: "idx_categories_tournament")` on Category
- `@@index([categoryId], map: "idx_teams_category")` on Team
- `@@index([categoryId, status], map: "idx_matches_category_status")` on Match
- `@@index([courtId, scheduledStartAt], map: "idx_schedule_entries_court_time")` on ScheduleEntry
- `@@index([tournamentId, occurredAt], map: "idx_audit_logs_tournament_time")` on AuditLog
- All FK indexes listed in Physical Design Section 14 should be represented either by Prisma `@@index` or confirmed as DB-created via migration

Always set `map:` to the exact physical index name from Physical Database Design.

---

## 13. Unsupported PostgreSQL Features

Features that require SQL migration alongside Prisma:

| Feature | Examples | Prisma Approach |
| --- | --- | --- |
| Partial Unique Index | one official version; active soft-delete uniques; active referee assignment | Create/maintain in SQL migration; keep Prisma model fields aligned |
| CHECK Constraint | date ordering; non-negative standings; match stage xor; flag exclusivity | SQL migration `ADD CONSTRAINT` |
| Advanced / partial indexes | `idx_matches_live` WHERE status in live set | SQL migration |
| Exact DESC index definitions | audit/event occurred_at DESC | SQL migration if Prisma index order insufficient |
| Generated columns | None in V1 | N/A |
| Exclusion constraints | Not specified in V1 | N/A |

### Coexistence rules

1. Prisma Migrate remains the migration runner.
2. Unsupported constraints are added in the same migration (or follow-up migration) using raw SQL.
3. Prisma schema still defines models/fields/relations/enums/declarative uniques/indexes.
4. CI must verify both Prisma schema validity and SQL constraints exist in the database.
5. Never drop SQL-only constraints during `prisma db push` experiments in shared environments.

---

## 14. Soft Delete Mapping

| Item | Rule |
| --- | --- |
| Fields | `deletedAt DateTime? @map("deleted_at") @db.Timestamptz(...)` |
| | `deletedBy String? @map("deleted_by") @db.Uuid` |
| Models with soft delete | Tournament, Category, Court, Team, Player, Sponsor, Gallery, GalleryItem |
| Models without soft delete | AuditLog, EventLog, version tables, Match, join tables, Review, Champion, RefereeAssignment, Drawing, Schedule, Playoff, Group, Standing, etc. per Physical Design |
| Query behavior | Application middleware/repositories filter `deletedAt: null` by default |
| Uniques | Soft-delete-aware uniqueness enforced in SQL, not naive `@@unique` alone |

Prisma does not provide built-in soft delete; implement in NestJS data access layer.

---

## 15. Audit Mapping

### Column audit profile

Map on mutable models:

- `createdAt` / `createdBy`
- `updatedAt` / `updatedBy`

### Append-only audit entities

| Model | Notes |
| --- | --- |
| AuditLog | Insert-only; no update/delete APIs |
| EventLog | Insert-only; no update/delete APIs |

Actor identity fields remain UUID strings until identity/user model is introduced; do not invent a User model in V1 unless Physical Design is extended.

---

## 16. Version Mapping

| Concern | Prisma Mapping Rule |
| --- | --- |
| Drawing versions | `DrawingVersion` model; `Drawing.currentOfficialVersion` named relation optional 1:1 |
| Schedule versions | `ScheduleVersion` model; `Schedule.currentOfficialVersion` named relation |
| Bracket versions | `Bracket` model with version fields; `Playoff.currentOfficialBracket` named relation |
| Version fields | `versionNumber`, `versionStatus`, `officialFlag`, `generationSource` |
| Immutability | Application forbids updates to historical/official version rows except controlled status transition to historical |
| Reviews | `Review.versionId` stores version UUID; optional typed relations later if artifact polymorphism requires app-level resolution |

Official-pointer cycles (Drawing ↔ DrawingVersion) require careful relation naming and optional FK on the parent pointer.

---

## 17. JSON Mapping

Per JSON Storage Policy in Physical Database Design:

| Field | Model | Prisma Type |
| --- | --- | --- |
| configuration | Category | `Json?` `@map("configuration")` `@db.JsonB` |
| scoreRepresentation | Match | `Json?` `@map("score_representation")` `@db.JsonB` |
| structureRepresentation | Bracket | `Json` `@map("structure_representation")` `@db.JsonB` |
| playerCompositionSnapshot | MatchParticipation | `Json?` `@map("player_composition_snapshot")` `@db.JsonB` |
| previousOfficialState / newOfficialState | AuditLog | `Json?` |

Do not introduce additional Json fields for core entities (Tournament, Category, Team, Player, Match, Standing as documents).

---

## 18. Naming Convention

| Object | Prisma Convention | Physical Convention |
| --- | --- | --- |
| Model | PascalCase singular | plural snake_case table via `@@map` |
| Field | camelCase | snake_case column via `@map` |
| Enum | PascalCase | snake_case PG enum type via `@@map` if needed |
| Enum value | camelCase or stable identifier | snake_case DB value via `@map` if needed |
| Relation field | camelCase semantic name | no column |
| Index/unique map names | exact physical names | `idx_...` / `uq_...` |

Rules:

- Always use `@@map("table_name")`
- Always use `@map("column_name")` for non-identical names
- Never rename physical tables to singular forms
- Use plural physical tables, singular Prisma models

---

## 19. Migration Strategy

| Step | Rule |
| --- | --- |
| Baseline | Generate initial migration from schema.prisma derived from this spec + SQL for unsupported features |
| Source of truth | Physical Database Design + this specification |
| Additive changes | Prefer additive migrations |
| Partial uniques / checks | Include raw SQL in migration |
| Deploy | `prisma migrate deploy` in CI/CD |
| Forbidden | Hand-editing production schema without migration |
| Sync order | Update Physical Design → update this spec → update schema.prisma → migrate |

---

## 20. Seed Strategy

| Item | Rule |
| --- | --- |
| Enums | Created by schema/migrations, not seed rows |
| Non-prod demo data | Optional seed script for tournaments/courts/users later |
| Production | No fake competition results |
| Identity/users | Outside Prisma V1 competition schema until identity model is designed |
| Seed runner | `prisma db seed` only after schema exists |

---

## Prisma Generation Order

`schema.prisma` should be authored incrementally according to dependency hierarchy. Generate and validate in layers rather than all models at once when practical.

### Recommended order

**Foundation**

- Tournament
- Court
- Sponsor
- Gallery
- GalleryItem

**Competition**

- Category
- Team
- Player

**Versioning**

- Drawing
- DrawingVersion
- Schedule
- ScheduleVersion

**Competition Runtime**

- Group
- GroupMember
- Match
- MatchParticipation
- Standing

**Playoff**

- Playoff
- Bracket
- Champion

**Operations**

- Review
- RefereeAssignment

**Infrastructure**

- AuditLog
- EventLog

Also add supporting pieces early enough for compilation:

- Enums before models that reference them
- ScheduleEntry after ScheduleVersion and Match exist
- Official-pointer relations (`Drawing` ↔ `DrawingVersion`, `Schedule` ↔ `ScheduleVersion`, `Playoff` ↔ `Bracket`) only after both sides exist

### Why this order helps

- Reduces relation errors by defining parents before children
- Reduces missing FK mistakes by establishing ownership chains first
- Reduces circular reference confusion by introducing official-version pointers after version models exist
- Reduces review complexity by allowing layer-by-layer validation

**Important:** This ordering is for implementation convenience only.  
It does **not** affect database semantics, ownership, or Physical Database Design.

---

## Prisma Validation Workflow

Recommended generation and verification flow:

```text
Generate schema
↓
Run prisma format
↓
Run prisma validate
↓
Review relation names
↓
Review indexes
↓
Generate migration
↓
Review SQL
↓
Run migrate dev
↓
Run migrate deploy
```

| Step | Purpose |
| --- | --- |
| Generate schema | Author `schema.prisma` from this specification and Physical Database Design |
| `prisma format` | Normalize formatting and catch basic structural issues |
| `prisma validate` | Confirm schema parses and relations/types are consistent |
| Review relation names | Ensure named relations follow business meaning and resolve multi-path ambiguity |
| Review indexes | Confirm `@@index` / `@@unique` map names match Physical Design; note SQL-only indexes |
| Generate migration | Create Prisma migration from schema delta |
| Review SQL | Verify CHECK constraints, partial unique indexes, and partial indexes are present as raw SQL where required |
| `migrate dev` | Apply and iterate in local/dev environments |
| `migrate deploy` | Apply approved migrations in shared/CI/production pipelines |

Do not treat `prisma db push` as a substitute for reviewed migrations in shared environments.

---

## Relation Naming Convention

Relation names should describe business meaning, not technical accident.

### Rules

- Prefer clear business phrases: parent + child or role + target
- Use PascalCase for `@relation("Name")` strings
- Use camelCase for relation fields on models
- Name official-pointer relations distinctly from history collections
- Avoid generic names such as `Relation1`, `Relation2`, `RelationA`

### Recommended relation name examples

| Relation Name | Meaning |
| --- | --- |
| TournamentCategories | Tournament owns Categories |
| TournamentCourts | Tournament owns Courts |
| TournamentSponsors | Tournament owns Sponsors |
| TournamentGallery | Tournament has Gallery |
| CategoryTeams | Category owns Teams |
| TeamPlayers | Team contains Players |
| DrawingVersions | Drawing has version history |
| DrawingOfficialVersion | Drawing points to Official DrawingVersion |
| ScheduleVersions | Schedule has version history |
| ScheduleOfficialVersion | Schedule points to Official ScheduleVersion |
| ScheduleEntries | ScheduleVersion contains ScheduleEntry |
| CategoryMatches | Category owns Matches |
| GroupMatches | Group contains group-stage Matches |
| PlayoffMatches | Playoff contains playoff-stage Matches |
| PlayoffBrackets | Playoff has Bracket versions |
| PlayoffOfficialBracket / CurrentOfficialBracket | Playoff points to Official Bracket |
| ChampionTeam | Champion references winning Team |
| MatchParticipations | Match has participating Teams |
| MatchRefereeAssignments | Match has RefereeAssignment records |
| StandingTeam | Standing references Team |

When multiple relations exist between the same two models, both the relation name and the field name must make the business role obvious.

---

## Prisma Style Guide

| Concern | Style |
| --- | --- |
| Model names | PascalCase singular |
| Field names | camelCase |
| Relation fields | camelCase |
| Enums | PascalCase |
| Enum values | lowercase (map to DB snake_case with `@map` when needed) |
| Table mapping | Always use `@@map("plural_snake_table")` |
| Column mapping | Always use `@map("snake_case_column")` for physical columns |

### Field grouping order inside each model

1. ID
2. FK scalars
3. Business fields
4. Enums
5. JSON
6. Audit fields
7. Soft delete fields
8. Relation fields
9. `@@unique` / `@@index` / `@@map` block attributes

Keep spacing and formatting consistent via `prisma format`.

---

## Common Implementation Pitfalls

| Pitfall | Why it hurts | Avoid by |
| --- | --- | --- |
| Missing `@@map` | Prisma creates singular/wrong table names diverging from Physical Design | Always map every model |
| Missing `@map` | camelCase columns created in DB | Map every snake_case column |
| Wrong optional relation | Required FK modeled as optional (or reverse) breaks integrity assumptions | Match nullability to Physical Design |
| Unnamed multi-path relations | Prisma cannot disambiguate Drawing/Schedule/Playoff official pointers | Use explicit relation names |
| Implicit many-to-many | Hides `GroupMember` / `MatchParticipation` join entities | Always model associative tables explicitly |
| Forgetting SQL-only constraints | Partial uniques/checks missing in real DB | Review migration SQL every time |
| Treating enums as strings | Weak typing and drift from Physical Design | Map all 17 enums |
| Putting core entities in `Json` | Violates JSON Storage Policy | Only approved JSONB columns |
| Updating AuditLog/EventLog | Breaks append-only auditability | Insert-only access patterns |
| Soft-delete unique without partial index | Duplicate “active” rows after soft delete | Keep SQL partial uniques |
| Using `db push` in shared envs | Skips reviewed SQL constraints | Use migrate workflow |
| Renaming physical tables for Prisma aesthetics | Breaks Physical Design authority | Never rename tables |

---

## 21. Generation Rules

Strict rules for creating `schema.prisma` later:

1. One Prisma model per physical table (26 models).
2. Every FK must have a `@relation`.
3. Every PostgreSQL enum must have a Prisma enum (17 enums).
4. Every documented declarative index/unique must be represented (`@@index` / `@@unique`) or explicitly deferred to SQL with a checklist entry.
5. Never rename physical tables.
6. Always use `@@map()` for models.
7. Always use `@map()` for snake_case columns.
8. Use plural physical tables and singular Prisma models.
9. Use named relations wherever multiple relations exist between the same models.
10. Map soft-delete and audit fields exactly as Physical Design.
11. Map JSONB only for the four approved business JSON columns (+ audit state JSON).
12. Do not invent models for PublishState/LockState/Version — they are enums/fields.
13. Do not invent User/Auth models unless Physical Design is extended.
14. Keep `rowVersion` on models that define optimistic concurrency.
15. Document SQL-only constraints in migration comments referencing Physical Design constraint names.

---

## 22. Validation Checklist

Before accepting generated `schema.prisma`:

### Coverage

- [ ] All 26 tables mapped to models
- [ ] All columns mapped for each model
- [ ] All 17 enums mapped
- [ ] All FKs mapped to relations
- [ ] All declarative uniques mapped
- [ ] All Section 14 indexes mapped or SQL-justified

### Relations

- [ ] No missing relation for any FK
- [ ] No duplicate ambiguous relations without names
- [ ] Official-version pointer relations named correctly
- [ ] No unintended implicit many-to-many
- [ ] Optional vs required FK nullability matches Physical Design
- [ ] No circular relation configuration errors in `prisma validate`

### Integrity

- [ ] Partial unique indexes present in SQL migration
- [ ] CHECK constraints present in SQL migration
- [ ] Partial live-match index present in SQL migration
- [ ] Soft-delete models filter strategy documented in backend
- [ ] Append-only AuditLog/EventLog have no update paths planned

### Policy

- [ ] JSON fields limited to approved columns
- [ ] No renamed physical tables
- [ ] `@@map` / `@map` used consistently
- [ ] Naming matches Glossary / Physical Design
- [ ] `prisma validate` passes
- [ ] Deviations documented before merge

---

## 23. Traceability

```text
Business Architecture
↓
Conceptual Data Model
↓
Logical ERD
↓
Physical Database Design
↓
Prisma Schema Specification (this document)
↓
schema.prisma
↓
SQL Migrations
↓
Prisma Client
↓
NestJS Backend
↓
REST / WebSocket APIs
↓
Next.js Frontend
```

---

## 24. Document Summary

| Metric | Count |
| --- | --- |
| Prisma Models (mapped) | 26 |
| Prisma Enums (mapped) | 17 |
| Field type mapping rules | 9 |
| Relation style categories | 6 |
| SQL-only feature categories | 4 |
| Soft-delete models | 8 |
| Approved JSON fields | 4 (+ audit JSON state fields) |
| Generation rules | 15 |
| Validation checklist items | 24 |
| Generation order layers | 7 |
| Documented implementation pitfalls | 12 |

Mapping metrics are unchanged from v0.1.0. v0.1.1 adds implementation-readiness guidance only.

---

## 25. Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Principal Prisma Architect | Initial Prisma Schema Specification derived from Physical Database Design v0.1.1 |
| 0.1.1 | 2026-07-25 | Principal Prisma Architect | Implementation readiness: Prisma Generation Order, Validation Workflow, Relation Naming Convention, Style Guide, Common Pitfalls. No mapping or generation-rule changes. |

---

*This Prisma Schema Specification is the authoritative blueprint for generating `schema.prisma`. Implementation must follow these mappings and rules without redefining business meaning or diverging from Physical Database Design.*
