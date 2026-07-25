# Physical Database Design

| Field | Value |
| --- | --- |
| Document | Physical Database Design |
| Product | Set Point |
| Version | 0.1.1 |
| Status | Physical Design Phase |
| Classification | Internal — Physical Data Architecture |
| Last Updated | 2026-07-25 |
| Database Engine | PostgreSQL 17+ |
| ORM Target | Prisma ORM |
| Application Targets | Next.js (FE), NestJS (BE) |
| Depends On | `00-project-charter.md` … `07-logical-erd.md` |

---

## 1. Purpose

This document transforms the approved Logical ERD into a **physical PostgreSQL database architecture**.

It is the authoritative source for:

- PostgreSQL implementation decisions
- Prisma schema generation
- Migration design
- Backend persistence modeling

It does not redefine business meaning. Business truth remains in Glossary, Domain Model, Business Rules, Conceptual Data Model, and Logical ERD.

**Priority**

```text
Logical ERD
↓
Conceptual Data Model
↓
Business Rules
↓
Domain Model
↓
SRS
```

This document does **not** contain Prisma schema files, raw SQL scripts, or migration files. Those are generated later from this design.

---

## 2. Scope

In scope:

- Physical tables mapped from logical entities
- Column definitions and PostgreSQL types
- Primary keys, foreign keys, unique/check constraints
- Enum mapping
- Index strategy
- Cascade rules
- Soft delete, audit, timestamp, versioning strategies
- Transaction, concurrency, migration, and seed strategies
- Performance, security, and backup considerations

Out of scope (later artifacts):

- Prisma schema source file
- SQL DDL scripts
- Migration code
- API contracts
- Caching layers

---

## 3. Database Design Principles

1. **Normalization** — Follow Logical ERD ~3NF mapping.
2. **Integrity First** — Enforce ownership and invariants with FK/unique/check constraints.
3. **Minimal Redundancy** — No duplicated authoritative facts across owners.
4. **Immutable History** — Version rows and audit/event logs are append-oriented; no silent overwrite of Official history.
5. **Optimistic Concurrency** — Prefer row version / `updated_at` checks for concurrent updates.
6. **Auditability** — Significant actions leave durable audit/event records.
7. **Version Awareness** — Drawing, Schedule, Playoff/Bracket versions are first-class tables.
8. **Consistency** — Physical names and constraints mirror Logical ERD and Glossary.
9. **Performance with Readability** — Indexes follow expected query patterns without obscuring model clarity.
10. **Aggregate Respect** — Tournament and Category ownership boundaries remain visible in FK design.

---

## 4. Database Standards

| Standard | Decision |
| --- | --- |
| Engine | PostgreSQL 17+ |
| Character set | UTF-8 |
| Time storage | `TIMESTAMPTZ` (UTC) |
| Primary key | `UUID` via `gen_random_uuid()` |
| Money | Not used in V1 core competition model |
| JSON usage | Limited to structured representations where Logical ERD allows (e.g. bracket structure, score representation) as `JSONB` |
| Boolean defaults | Explicit `NOT NULL` with defaults where business meaning is binary |
| Soft delete | `deleted_at` / `deleted_by` on mutable business tables; never on append-only logs |
| Actor identity | `UUID` nullable columns referencing future users identity store (logical actor id) |
| Schema | Single application schema `public` for V1 (extensible later) |

---

## JSON Storage Policy

JSONB is acceptable only for narrowly defined, non-relational payloads already identified in the Logical ERD / Physical Column Definitions.

### Allowed JSONB usage

| Column / Concept | Table | Why allowed |
| --- | --- | --- |
| Category Configuration | `categories.configuration` | Opaque / semi-structured Category configuration |
| Score Representation | `matches.score_representation` | Semi-structured live score payload |
| Bracket Structure Representation | `brackets.structure_representation` | Engine-generated bracket structure |
| Player Composition Snapshot | `match_participations.player_composition_snapshot` | Immutable participation snapshot |

### JSONB is reserved for

- Semi-structured data
- Opaque configuration
- Immutable snapshots
- Engine-generated structures that are not independently queried as first-class relational entities

### Explicitly prohibited

JSONB must **not** store core relational business entities or substitute for tables/FKs.

**Not allowed to be modeled primarily as JSON**

- Tournament
- Category
- Team
- Player
- Match
- Standing

Authoritative business data must always remain relational (tables, keys, constraints, and relationships defined in this document).

JSONB columns must never become the system of record for ownership, lifecycle state, or identity of core entities.

---

## 5. Naming Convention

| Object | Convention | Example |
| --- | --- | --- |
| Tables | snake_case, plural | `tournaments`, `drawing_versions` |
| Columns | snake_case | `created_at`, `publish_state` |
| Primary key | `id` | `tournaments.id` |
| Foreign key column | `<singular>_id` | `category_id` |
| Enum types | PascalCase type name in Prisma; snake values in PG if preferred — physical enum type: `snake_case` | `tournament_status` |
| Indexes | `idx_<table>_<columns>` | `idx_matches_status` |
| Unique constraints | `uq_<table>_<columns>` | `uq_categories_tournament_name` |
| Foreign key constraints | `fk_<child>_<parent>` | `fk_matches_categories` |
| Check constraints | `ck_<table>_<rule>` | `ck_tournaments_dates` |
| Join/assoc tables | plural business name | `group_members`, `match_participations` |

Reserved-word note: table `groups` is acceptable in PostgreSQL when unquoted in modern usage as identifier `groups`; Prisma model name `Group` maps to `@@map("groups")`.

---

## 6. Schema Organization

V1 uses one PostgreSQL schema:

- `public` — all Set Point application tables

Logical groupings (documentation only, not separate PG schemas):

| Group | Tables |
| --- | --- |
| Tournament Management | `tournaments`, `courts`, `sponsors`, `galleries`, `gallery_items` |
| Competition | `categories`, `teams`, `players`, `drawings`, `drawing_versions`, `groups`, `group_members`, `standings`, `playoffs`, `brackets`, `champions` |
| Scheduling | `schedules`, `schedule_versions`, `schedule_entries` |
| Live Operations | `matches`, `match_participations`, `referee_assignments` |
| Governance | `reviews`, `audit_logs`, `event_logs` |

Conceptual state concepts (`PublishState`, `LockState`, `VersionStatus`) are **enums/columns**, not tables.

---

## 7. Table Catalog

### tournaments

| Field | Value |
| --- | --- |
| Purpose | Physical store for Tournament Aggregate Root |
| Mapped From | Tournament |
| Soft Delete | Yes |
| Audit | Yes |
| Versioned rows | No (lifecycle via status enum) |

### categories

| Field | Value |
| --- | --- |
| Purpose | Competition boundary owned by Tournament |
| Mapped From | Category |
| Soft Delete | Yes |
| Audit | Yes |

### courts

| Field | Value |
| --- | --- |
| Purpose | Tournament-owned venue resources |
| Mapped From | Court |
| Soft Delete | Yes |
| Audit | Yes |

### teams

| Field | Value |
| --- | --- |
| Purpose | Competing units in a Category |
| Mapped From | Team |
| Soft Delete | Yes |
| Audit | Yes |

### players

| Field | Value |
| --- | --- |
| Purpose | Player composition of a Team |
| Mapped From | Player |
| Soft Delete | Yes |
| Audit | Yes |

### drawings

| Field | Value |
| --- | --- |
| Purpose | Drawing context per Category |
| Mapped From | Drawing |
| Soft Delete | No (retain for integrity) |
| Audit | Yes |
| Version | Via `drawing_versions` |

### drawing_versions

| Field | Value |
| --- | --- |
| Purpose | Immutable Drawing generations including seed |
| Mapped From | Drawing Version |
| Soft Delete | No |
| Audit | Yes |
| Version | Yes |

### groups

| Field | Value |
| --- | --- |
| Purpose | Group-stage pools |
| Mapped From | Group |
| Soft Delete | No after competition use; soft delete only before lock if ever allowed |
| Audit | Yes |

### group_members

| Field | Value |
| --- | --- |
| Purpose | Team placement in Group |
| Mapped From | Group Membership |
| Soft Delete | No |
| Audit | Created metadata only |

### schedules

| Field | Value |
| --- | --- |
| Purpose | Schedule context per Category |
| Mapped From | Schedule |
| Soft Delete | No |
| Audit | Yes |
| Version | Via `schedule_versions` |

### schedule_versions

| Field | Value |
| --- | --- |
| Purpose | Immutable Schedule generations |
| Mapped From | Schedule Version |
| Soft Delete | No |
| Audit | Yes |
| Version | Yes |

### schedule_entries

| Field | Value |
| --- | --- |
| Purpose | Match timing and court assignment within a Schedule Version |
| Mapped From | Schedule Entry |
| Soft Delete | No |
| Audit | Yes (reschedule tracked) |

### matches

| Field | Value |
| --- | --- |
| Purpose | Atomic competitive contests |
| Mapped From | Match |
| Soft Delete | No |
| Audit | Yes |

### match_participations

| Field | Value |
| --- | --- |
| Purpose | Competing sides in a Match |
| Mapped From | Match Participation |
| Soft Delete | No |
| Audit | Created metadata |

### standings

| Field | Value |
| --- | --- |
| Purpose | Ranked positions from Verified results |
| Mapped From | Standing |
| Soft Delete | No |
| Audit | Yes |

### playoffs

| Field | Value |
| --- | --- |
| Purpose | Playoff stage context |
| Mapped From | Playoff |
| Soft Delete | No |
| Audit | Yes |
| Version | Via bracket/version fields |

### brackets

| Field | Value |
| --- | --- |
| Purpose | Bracket structure versions for Playoff |
| Mapped From | Bracket |
| Soft Delete | No |
| Audit | Yes |
| Version | Yes |

### champions

| Field | Value |
| --- | --- |
| Purpose | Declared Champion outcome |
| Mapped From | Champion |
| Soft Delete | No |
| Audit | Yes |

### sponsors

| Field | Value |
| --- | --- |
| Purpose | Tournament sponsors |
| Mapped From | Sponsor |
| Soft Delete | Yes |
| Audit | Yes |

### galleries

| Field | Value |
| --- | --- |
| Purpose | Tournament gallery context |
| Mapped From | Gallery |
| Soft Delete | Yes |
| Audit | Yes |

### gallery_items

| Field | Value |
| --- | --- |
| Purpose | Media items in Gallery |
| Mapped From | Gallery Item |
| Soft Delete | Yes |
| Audit | Yes |

### reviews

| Field | Value |
| --- | --- |
| Purpose | Review decisions for generated artifact versions |
| Mapped From | Review |
| Soft Delete | No |
| Audit | Yes |

### audit_logs

| Field | Value |
| --- | --- |
| Purpose | Append-only accountability log |
| Mapped From | Audit Log |
| Soft Delete | **Never** |
| Audit | Self |

### event_logs

| Field | Value |
| --- | --- |
| Purpose | Append-only domain event timeline |
| Mapped From | Event Log |
| Soft Delete | **Never** |
| Audit | Self |

### referee_assignments

| Field | Value |
| --- | --- |
| Purpose | Referee-to-Match assignment |
| Mapped From | Referee Assignment |
| Soft Delete | No (use status + unassigned_at) |
| Audit | Yes |

**Total physical tables: 26**

---

## 8. Column Definitions

Conventions used below:

- `id UUID NOT NULL DEFAULT gen_random_uuid()`
- Actor columns: `UUID NULL` (identity provider mapping later)
- Enum columns use mapped PostgreSQL enums (Section 13)
- Timestamps: `TIMESTAMPTZ`

### Common column profiles (physical)

**Audit profile (mutable tables)**

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| created_at | TIMESTAMPTZ | NOT NULL | now() |
| created_by | UUID | NULL | — |
| updated_at | TIMESTAMPTZ | NOT NULL | now() |
| updated_by | UUID | NULL | — |

**Soft delete profile**

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| deleted_at | TIMESTAMPTZ | NULL | — |
| deleted_by | UUID | NULL | — |

**Publish profile**

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| publish_state | publish_state | NOT NULL | 'unpublished' |
| published_at | TIMESTAMPTZ | NULL | — |
| published_by | UUID | NULL | — |

**Lock profile**

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| lock_state | lock_state | NOT NULL | 'unlocked' |
| locked_at | TIMESTAMPTZ | NULL | — |
| locked_by | UUID | NULL | — |
| unlock_reason | TEXT | NULL | — |
| unlocked_at | TIMESTAMPTZ | NULL | — |
| unlocked_by | UUID | NULL | — |

**Optimistic concurrency**

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| row_version | INTEGER | NOT NULL | 1 |

---

### tournaments

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| name | VARCHAR(200) | NOT NULL | — | Tournament name |
| description | TEXT | NULL | — | Description |
| status | tournament_status | NOT NULL | 'draft' | Lifecycle status |
| registration_open_at | TIMESTAMPTZ | NULL | — | Registration open |
| registration_close_at | TIMESTAMPTZ | NULL | — | Registration close |
| start_at | TIMESTAMPTZ | NULL | — | Start |
| end_at | TIMESTAMPTZ | NULL | — | End |
| visibility | visibility | NOT NULL | 'private' | Visibility |
| publish_state | publish_state | NOT NULL | 'unpublished' | Publish state |
| published_at | TIMESTAMPTZ | NULL | — | Published time |
| published_by | UUID | NULL | — | Publisher |
| row_version | INTEGER | NOT NULL | 1 | Optimistic concurrency |
| + audit profile | | | | |
| + soft delete profile | | | | |

### categories

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| tournament_id | UUID | NOT NULL | — | FK → tournaments |
| name | VARCHAR(200) | NOT NULL | — | Category name |
| format | VARCHAR(100) | NOT NULL | — | Category format |
| configuration | JSONB | NULL | — | Category configuration |
| visibility | visibility | NOT NULL | 'private' | Visibility |
| publish_state | publish_state | NOT NULL | 'unpublished' | Publish |
| published_at / published_by | | | | Publish profile |
| lock_state + lock profile | | | | Lock |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit + soft delete | | | | |

### courts

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| tournament_id | UUID | NOT NULL | — | FK → tournaments |
| name | VARCHAR(200) | NOT NULL | — | Court name |
| label | VARCHAR(50) | NOT NULL | — | Court label |
| status | court_status | NOT NULL | 'available' | Court status |
| availability_notes | TEXT | NULL | — | Notes |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit + soft delete | | | | |

### teams

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| category_id | UUID | NOT NULL | — | FK → categories |
| name | VARCHAR(200) | NOT NULL | — | Team name |
| status | team_status | NOT NULL | 'active' | Team status |
| eligibility_status | eligibility_status | NOT NULL | 'ineligible' | Eligibility |
| withdrawal_flag | BOOLEAN | NOT NULL | false | Withdrawn |
| withdrawal_reason | TEXT | NULL | — | Reason |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit + soft delete | | | | |

### players

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| team_id | UUID | NOT NULL | — | FK → teams |
| display_name | VARCHAR(200) | NOT NULL | — | Display name |
| status | player_status | NOT NULL | 'active' | Status |
| replacement_flag | BOOLEAN | NOT NULL | false | Replacement marker |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit + soft delete | | | | |

### drawings

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| category_id | UUID | NOT NULL | — | FK → categories (unique) |
| current_official_version_id | UUID | NULL | — | FK → drawing_versions |
| review_status | review_status | NOT NULL | 'pending' | Review status summary |
| publish_state + publish profile | | | | |
| lock_state + lock profile | | | | |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit (no soft delete) | | | | |

### drawing_versions

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| drawing_id | UUID | NOT NULL | — | FK → drawings |
| version_number | INTEGER | NOT NULL | — | Version number |
| drawing_seed | VARCHAR(128) | NOT NULL | — | Reproducibility seed |
| version_status | version_status | NOT NULL | 'candidate' | Version status |
| official_flag | BOOLEAN | NOT NULL | false | Official marker |
| generation_source | VARCHAR(50) | NOT NULL | 'engine' | Source |
| review_outcome | review_status | NULL | — | Review outcome |
| created_at | TIMESTAMPTZ | NOT NULL | now() | Created |
| created_by | UUID | NULL | — | Creator |

### groups

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| category_id | UUID | NOT NULL | — | FK → categories |
| drawing_version_id | UUID | NOT NULL | — | FK → drawing_versions |
| name | VARCHAR(100) | NOT NULL | — | Group name |
| label | VARCHAR(50) | NULL | — | Label |
| publish_state + publish profile | | | | |
| lock_state + lock profile | | | | |
| + audit | | | | |

### group_members

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| group_id | UUID | NOT NULL | — | FK → groups |
| team_id | UUID | NOT NULL | — | FK → teams |
| drawing_version_id | UUID | NOT NULL | — | FK → drawing_versions |
| placement_order | INTEGER | NOT NULL | — | Placement order |
| created_at | TIMESTAMPTZ | NOT NULL | now() | Created |

### schedules

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| category_id | UUID | NOT NULL | — | FK → categories (unique) |
| current_official_version_id | UUID | NULL | — | FK → schedule_versions |
| review_status | review_status | NOT NULL | 'pending' | Review summary |
| publish_state + publish profile | | | | |
| lock_state + lock profile | | | | |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit | | | | |

### schedule_versions

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| schedule_id | UUID | NOT NULL | — | FK → schedules |
| version_number | INTEGER | NOT NULL | — | Version number |
| version_status | version_status | NOT NULL | 'candidate' | Status |
| official_flag | BOOLEAN | NOT NULL | false | Official |
| generation_source | VARCHAR(50) | NOT NULL | 'engine' | Source |
| review_outcome | review_status | NULL | — | Review |
| conflict_status | conflict_status | NOT NULL | 'unknown' | Conflict detection |
| created_at / created_by | | | | |

### schedule_entries

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| schedule_version_id | UUID | NOT NULL | — | FK → schedule_versions |
| match_id | UUID | NOT NULL | — | FK → matches |
| court_id | UUID | NULL | — | FK → courts |
| scheduled_start_at | TIMESTAMPTZ | NOT NULL | — | Start |
| scheduled_end_at | TIMESTAMPTZ | NULL | — | End |
| sequence_order | INTEGER | NOT NULL | — | Order |
| reschedule_flag | BOOLEAN | NOT NULL | false | Rescheduled |
| created_at | TIMESTAMPTZ | NOT NULL | now() | Created |
| updated_at | TIMESTAMPTZ | NOT NULL | now() | Updated |

### matches

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| category_id | UUID | NOT NULL | — | FK → categories |
| group_id | UUID | NULL | — | FK → groups |
| playoff_id | UUID | NULL | — | FK → playoffs |
| bracket_id | UUID | NULL | — | FK → brackets |
| bracket_position | VARCHAR(50) | NULL | — | Bracket slot |
| schedule_version_id | UUID | NULL | — | FK → schedule_versions |
| court_id | UUID | NULL | — | FK → courts |
| status | match_status | NOT NULL | 'waiting' | Match status |
| scheduled_start_at | TIMESTAMPTZ | NULL | — | Scheduled start |
| actual_start_at | TIMESTAMPTZ | NULL | — | Actual start |
| actual_end_at | TIMESTAMPTZ | NULL | — | Actual end |
| score_representation | JSONB | NULL | — | Score payload |
| result_status | result_status | NOT NULL | 'pending' | Result status |
| cancellation_flag | BOOLEAN | NOT NULL | false | Cancelled |
| abandonment_flag | BOOLEAN | NOT NULL | false | Abandoned |
| exception_reason | TEXT | NULL | — | Exception |
| publish_visibility | visibility | NOT NULL | 'private' | Visibility |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit | | | | |

### match_participations

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| match_id | UUID | NOT NULL | — | FK → matches |
| team_id | UUID | NOT NULL | — | FK → teams |
| side_label | VARCHAR(20) | NOT NULL | — | Side A/B |
| player_composition_snapshot | JSONB | NULL | — | Snapshot |
| created_at | TIMESTAMPTZ | NOT NULL | now() | Created |

### standings

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| category_id | UUID | NOT NULL | — | FK → categories |
| group_id | UUID | NULL | — | FK → groups |
| team_id | UUID | NOT NULL | — | FK → teams |
| rank_position | INTEGER | NULL | — | Rank |
| matches_played | INTEGER | NOT NULL | 0 | Played |
| wins | INTEGER | NOT NULL | 0 | Wins |
| losses | INTEGER | NOT NULL | 0 | Losses |
| points | INTEGER | NOT NULL | 0 | Points |
| tie_break_notes | TEXT | NULL | — | Tie-break notes |
| qualification_status | qualification_status | NOT NULL | 'not_qualified' | Qualification |
| publish_state + publish profile | | | | |
| lock_state + lock profile | | | | |
| last_recalculated_at | TIMESTAMPTZ | NULL | — | Recalc time |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit | | | | |

### playoffs

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| category_id | UUID | NOT NULL | — | FK → categories (unique) |
| current_official_bracket_id | UUID | NULL | — | FK → brackets |
| review_status | review_status | NOT NULL | 'pending' | Review |
| qualification_basis | TEXT | NULL | — | Qualification basis |
| publish_state + publish profile | | | | |
| lock_state + lock profile | | | | |
| row_version | INTEGER | NOT NULL | 1 | Concurrency |
| + audit | | | | |

### brackets

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| playoff_id | UUID | NOT NULL | — | FK → playoffs |
| version_number | INTEGER | NOT NULL | — | Version |
| version_status | version_status | NOT NULL | 'candidate' | Status |
| official_flag | BOOLEAN | NOT NULL | false | Official |
| generation_source | VARCHAR(50) | NOT NULL | 'engine' | Source |
| structure_representation | JSONB | NOT NULL | — | Bracket map |
| publish_state + publish profile | | | | |
| lock_state + lock profile | | | | |
| + audit | | | | |

### champions

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| playoff_id | UUID | NOT NULL | — | FK → playoffs (unique) |
| category_id | UUID | NOT NULL | — | FK → categories |
| winning_team_id | UUID | NOT NULL | — | FK → teams |
| declaration_status | declaration_status | NOT NULL | 'declared' | Status |
| declared_at | TIMESTAMPTZ | NOT NULL | now() | Declared time |
| declared_by | UUID | NULL | — | Declared by |

### sponsors

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| tournament_id | UUID | NOT NULL | — | FK → tournaments |
| name | VARCHAR(200) | NOT NULL | — | Name |
| display_order | INTEGER | NOT NULL | 0 | Order |
| visibility | visibility | NOT NULL | 'public' | Visibility |
| + audit + soft delete | | | | |

### galleries

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| tournament_id | UUID | NOT NULL | — | FK → tournaments (unique) |
| title | VARCHAR(200) | NOT NULL | — | Title |
| visibility | visibility | NOT NULL | 'public' | Visibility |
| + audit + soft delete | | | | |

### gallery_items

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| gallery_id | UUID | NOT NULL | — | FK → galleries |
| media_title | VARCHAR(200) | NULL | — | Title |
| media_reference | TEXT | NOT NULL | — | Storage reference |
| display_order | INTEGER | NOT NULL | 0 | Order |
| visibility | visibility | NOT NULL | 'public' | Visibility |
| + audit + soft delete | | | | |

### reviews

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| artifact_type | artifact_type | NOT NULL | — | drawing/schedule/playoff |
| artifact_id | UUID | NOT NULL | — | Artifact id |
| version_id | UUID | NOT NULL | — | Version id |
| status | review_status | NOT NULL | 'pending' | Status |
| reviewer_id | UUID | NULL | — | Reviewer |
| decision | review_status | NULL | — | Decision |
| notes | TEXT | NULL | — | Notes |
| reviewed_at | TIMESTAMPTZ | NULL | — | Reviewed time |
| created_at | TIMESTAMPTZ | NOT NULL | now() | Created |

### audit_logs

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| tournament_id | UUID | NULL | — | FK → tournaments |
| actor_id | UUID | NULL | — | Actor |
| action_type | VARCHAR(100) | NOT NULL | — | Action |
| affected_entity_type | VARCHAR(100) | NOT NULL | — | Entity type |
| affected_entity_id | UUID | NOT NULL | — | Entity id |
| previous_official_state | JSONB | NULL | — | Before |
| new_official_state | JSONB | NULL | — | After |
| reason | TEXT | NULL | — | Reason |
| related_version_id | UUID | NULL | — | Version |
| occurred_at | TIMESTAMPTZ | NOT NULL | now() | When |

### event_logs

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| tournament_id | UUID | NULL | — | FK → tournaments |
| event_type | VARCHAR(100) | NOT NULL | — | Event type |
| related_entity_type | VARCHAR(100) | NULL | — | Entity type |
| related_entity_id | UUID | NULL | — | Entity id |
| event_meaning | TEXT | NOT NULL | — | Meaning |
| occurred_at | TIMESTAMPTZ | NOT NULL | now() | When |

### referee_assignments

| Column | Type | Nullable | Default | Purpose |
| --- | --- | --- | --- | --- |
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| match_id | UUID | NOT NULL | — | FK → matches |
| referee_id | UUID | NOT NULL | — | Referee identity |
| assignment_status | assignment_status | NOT NULL | 'active' | Status |
| assigned_by | UUID | NULL | — | Assigner |
| assigned_at | TIMESTAMPTZ | NOT NULL | now() | Assigned |
| unassigned_at | TIMESTAMPTZ | NULL | — | Unassigned |

---

## 9. Primary Keys

Every table uses:

| Column | Type | Default |
| --- | --- | --- |
| id | UUID | gen_random_uuid() |

No natural composite PKs. Business uniqueness is enforced with unique constraints.

---

## 10. Foreign Keys

| Constraint | Child | Column | Parent | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- | --- |
| fk_categories_tournaments | categories | tournament_id | tournaments | RESTRICT | CASCADE |
| fk_courts_tournaments | courts | tournament_id | tournaments | RESTRICT | CASCADE |
| fk_sponsors_tournaments | sponsors | tournament_id | tournaments | CASCADE | CASCADE |
| fk_galleries_tournaments | galleries | tournament_id | tournaments | CASCADE | CASCADE |
| fk_gallery_items_galleries | gallery_items | gallery_id | galleries | CASCADE | CASCADE |
| fk_teams_categories | teams | category_id | categories | RESTRICT | CASCADE |
| fk_players_teams | players | team_id | teams | CASCADE | CASCADE |
| fk_drawings_categories | drawings | category_id | categories | RESTRICT | CASCADE |
| fk_drawings_official_version | drawings | current_official_version_id | drawing_versions | SET NULL | CASCADE |
| fk_drawing_versions_drawings | drawing_versions | drawing_id | drawings | CASCADE | CASCADE |
| fk_groups_categories | groups | category_id | categories | RESTRICT | CASCADE |
| fk_groups_drawing_versions | groups | drawing_version_id | drawing_versions | RESTRICT | CASCADE |
| fk_group_members_groups | group_members | group_id | groups | CASCADE | CASCADE |
| fk_group_members_teams | group_members | team_id | teams | RESTRICT | CASCADE |
| fk_group_members_drawing_versions | group_members | drawing_version_id | drawing_versions | RESTRICT | CASCADE |
| fk_schedules_categories | schedules | category_id | categories | RESTRICT | CASCADE |
| fk_schedules_official_version | schedules | current_official_version_id | schedule_versions | SET NULL | CASCADE |
| fk_schedule_versions_schedules | schedule_versions | schedule_id | schedules | CASCADE | CASCADE |
| fk_schedule_entries_versions | schedule_entries | schedule_version_id | schedule_versions | CASCADE | CASCADE |
| fk_schedule_entries_matches | schedule_entries | match_id | matches | RESTRICT | CASCADE |
| fk_schedule_entries_courts | schedule_entries | court_id | courts | SET NULL | CASCADE |
| fk_matches_categories | matches | category_id | categories | RESTRICT | CASCADE |
| fk_matches_groups | matches | group_id | groups | SET NULL | CASCADE |
| fk_matches_playoffs | matches | playoff_id | playoffs | SET NULL | CASCADE |
| fk_matches_brackets | matches | bracket_id | brackets | SET NULL | CASCADE |
| fk_matches_schedule_versions | matches | schedule_version_id | schedule_versions | SET NULL | CASCADE |
| fk_matches_courts | matches | court_id | courts | SET NULL | CASCADE |
| fk_match_participations_matches | match_participations | match_id | matches | CASCADE | CASCADE |
| fk_match_participations_teams | match_participations | team_id | teams | RESTRICT | CASCADE |
| fk_standings_categories | standings | category_id | categories | RESTRICT | CASCADE |
| fk_standings_groups | standings | group_id | groups | SET NULL | CASCADE |
| fk_standings_teams | standings | team_id | teams | RESTRICT | CASCADE |
| fk_playoffs_categories | playoffs | category_id | categories | RESTRICT | CASCADE |
| fk_playoffs_official_bracket | playoffs | current_official_bracket_id | brackets | SET NULL | CASCADE |
| fk_brackets_playoffs | brackets | playoff_id | playoffs | CASCADE | CASCADE |
| fk_champions_playoffs | champions | playoff_id | playoffs | RESTRICT | CASCADE |
| fk_champions_categories | champions | category_id | categories | RESTRICT | CASCADE |
| fk_champions_teams | champions | winning_team_id | teams | RESTRICT | CASCADE |
| fk_referee_assignments_matches | referee_assignments | match_id | matches | CASCADE | CASCADE |
| fk_audit_logs_tournaments | audit_logs | tournament_id | tournaments | SET NULL | CASCADE |
| fk_event_logs_tournaments | event_logs | tournament_id | tournaments | SET NULL | CASCADE |

---

## 11. Unique Constraints

| Constraint | Table | Columns | Business Meaning |
| --- | --- | --- | --- |
| uq_tournaments_name_active | tournaments | (name) WHERE deleted_at IS NULL | Unique active tournament name (operator scope V1) |
| uq_categories_tournament_name | categories | (tournament_id, name) WHERE deleted_at IS NULL | Unique category name per tournament |
| uq_courts_tournament_label | courts | (tournament_id, label) WHERE deleted_at IS NULL | Unique court label per tournament |
| uq_teams_category_name | teams | (category_id, name) WHERE deleted_at IS NULL | Unique team name per category |
| uq_drawings_category | drawings | (category_id) | One drawing context per category |
| uq_drawing_versions_number | drawing_versions | (drawing_id, version_number) | Unique version number |
| uq_drawing_versions_one_official | drawing_versions | (drawing_id) WHERE official_flag = true | At most one official drawing version |
| uq_groups_version_name | groups | (drawing_version_id, name) | Unique group name per drawing version |
| uq_group_members_group_team | group_members | (group_id, team_id) | Team once per group |
| uq_schedules_category | schedules | (category_id) | One schedule context per category |
| uq_schedule_versions_number | schedule_versions | (schedule_id, version_number) | Unique version number |
| uq_schedule_versions_one_official | schedule_versions | (schedule_id) WHERE official_flag = true | At most one official schedule version |
| uq_schedule_entries_version_match | schedule_entries | (schedule_version_id, match_id) | Match once per schedule version |
| uq_match_participations_match_side | match_participations | (match_id, side_label) | Unique side per match |
| uq_match_participations_match_team | match_participations | (match_id, team_id) | Team once per match |
| uq_standings_category_team_group | standings | (category_id, team_id, group_id) | One standing row per team context |
| uq_playoffs_category | playoffs | (category_id) | One playoff per category |
| uq_brackets_playoff_number | brackets | (playoff_id, version_number) | Unique bracket version |
| uq_brackets_one_official | brackets | (playoff_id) WHERE official_flag = true | At most one official bracket |
| uq_champions_playoff | champions | (playoff_id) | One champion per playoff |
| uq_galleries_tournament | galleries | (tournament_id) | One gallery context per tournament |
| uq_referee_assignments_active | referee_assignments | (match_id) WHERE assignment_status = 'active' | One active referee per match |

---

## 12. Check Constraints

| Constraint | Table | Rule |
| --- | --- | --- |
| ck_tournaments_reg_dates | tournaments | registration_open_at IS NULL OR registration_close_at IS NULL OR registration_open_at <= registration_close_at |
| ck_tournaments_event_dates | tournaments | start_at IS NULL OR end_at IS NULL OR start_at <= end_at |
| ck_standings_nonneg | standings | wins >= 0 AND losses >= 0 AND points >= 0 AND matches_played >= 0 |
| ck_standings_rank | standings | rank_position IS NULL OR rank_position >= 1 |
| ck_drawing_versions_number | drawing_versions | version_number >= 1 |
| ck_schedule_versions_number | schedule_versions | version_number >= 1 |
| ck_brackets_number | brackets | version_number >= 1 |
| ck_schedule_entries_time | schedule_entries | scheduled_end_at IS NULL OR scheduled_start_at <= scheduled_end_at |
| ck_matches_stage_xor | matches | NOT (group_id IS NOT NULL AND playoff_id IS NOT NULL) OR business allows both null during creation — enforce: (group_id IS NULL) OR (playoff_id IS NULL) |
| ck_matches_flags | matches | NOT (cancellation_flag AND abandonment_flag) |
| ck_group_members_order | group_members | placement_order >= 1 |
| ck_sponsors_order | sponsors | display_order >= 0 |
| ck_gallery_items_order | gallery_items | display_order >= 0 |

Application-layer Business Rules remain authoritative for complex lifecycle transitions; checks enforce local scalar integrity.

---

## 13. Enum Mapping

| Logical Reference Concept | PostgreSQL Enum | Values |
| --- | --- | --- |
| Tournament Status | `tournament_status` | draft, setup, published, live, finished, archived |
| Match Status | `match_status` | waiting, warm_up, live, finished, verified |
| Version Status | `version_status` | candidate, official, historical |
| Publish State | `publish_state` | unpublished, published |
| Lock State | `lock_state` | unlocked, locked |
| Review Status | `review_status` | pending, approved, rejected |
| Visibility | `visibility` | private, public |
| Court Status | `court_status` | available, unavailable, maintenance |
| Team Status | `team_status` | active, withdrawn |
| Player Status | `player_status` | active, replaced, inactive |
| Eligibility Status | `eligibility_status` | eligible, ineligible |
| Qualification Status | `qualification_status` | qualified, not_qualified |
| Result Status | `result_status` | pending, normal, cancelled, abandoned, corrected |
| Assignment Status | `assignment_status` | active, inactive |
| Conflict Status | `conflict_status` | unknown, clear, conflict |
| Declaration Status | `declaration_status` | declared |
| Artifact Type | `artifact_type` | drawing, schedule, playoff, bracket |

Prisma mapping: enums declared in schema and mapped to PostgreSQL enum types.

---

## 14. Index Strategy

| Index | Table | Columns | Why |
| --- | --- | --- | --- |
| PK | all | id | Primary access |
| idx_categories_tournament | categories | tournament_id | List categories by tournament |
| idx_courts_tournament | courts | tournament_id | Court lookup |
| idx_teams_category | teams | category_id | Team list |
| idx_players_team | players | team_id | Composition |
| idx_drawing_versions_drawing | drawing_versions | drawing_id | Version history |
| idx_groups_category | groups | category_id | Groups by category |
| idx_groups_drawing_version | groups | drawing_version_id | Groups by drawing version |
| idx_group_members_team | group_members | team_id | Reverse lookup |
| idx_schedule_versions_schedule | schedule_versions | schedule_id | Version history |
| idx_schedule_entries_version | schedule_entries | schedule_version_id | Entries by version |
| idx_schedule_entries_court_time | schedule_entries | court_id, scheduled_start_at | Conflict detection |
| idx_matches_category | matches | category_id | Matches by category |
| idx_matches_status | matches | status | Live ops filters |
| idx_matches_court | matches | court_id | Court usage |
| idx_matches_group | matches | group_id | Group stage |
| idx_matches_playoff | matches | playoff_id | Playoff stage |
| idx_match_participations_team | match_participations | team_id | Team match history |
| idx_standings_category | standings | category_id | Standings view |
| idx_standings_team | standings | team_id | Team standing |
| idx_brackets_playoff | brackets | playoff_id | Bracket versions |
| idx_reviews_artifact | reviews | artifact_type, artifact_id | Review lookup |
| idx_audit_logs_tournament_time | audit_logs | tournament_id, occurred_at DESC | Audit inspection |
| idx_event_logs_tournament_time | event_logs | tournament_id, occurred_at DESC | Event timeline |
| idx_referee_assignments_referee | referee_assignments | referee_id | Referee workload |
| idx_tournaments_status | tournaments | status | Lifecycle filters |
| idx_matches_category_status | matches | category_id, status | Composite live ops |

Partial indexes recommended:

- `idx_matches_live` on `matches(category_id)` WHERE `status IN ('warm_up','live')`
- Soft-delete aware unique indexes already listed in Section 11

---

## Index Classification

Indexes in Section 14 are grouped by purpose to guide implementation and maintenance. This classification does not add or remove indexes.

### Primary Indexes

| Aspect | Guidance |
| --- | --- |
| Purpose | Uniquely identify rows |
| Typical query pattern | Point lookup by `id` |
| Performance benefit | O(1)/highly selective access to a single row |
| Maintenance | Created automatically with PK; low controversy |

### Foreign Key Indexes

| Aspect | Guidance |
| --- | --- |
| Purpose | Accelerate joins and parent/child navigation |
| Typical query pattern | `WHERE category_id = ?`, `WHERE tournament_id = ?` |
| Performance benefit | Avoid sequential scans on child tables during Aggregate loads |
| Maintenance | Keep aligned with every FK used in hot paths |

### Lookup Indexes

| Aspect | Guidance |
| --- | --- |
| Purpose | Support common list/filter screens |
| Typical query pattern | Teams by category, courts by tournament, reviews by artifact |
| Performance benefit | Faster operator workflows in Setup/Published states |
| Maintenance | Prefer narrow indexes matching actual filters |

### Reporting Indexes

| Aspect | Guidance |
| --- | --- |
| Purpose | Support audit/event inspection and historical reads |
| Typical query pattern | `audit_logs` / `event_logs` by tournament + time descending |
| Performance benefit | Predictable admin investigation performance |
| Maintenance | Append-only tables; monitor bloat; avoid unnecessary updates |

### Live Operation Indexes

| Aspect | Guidance |
| --- | --- |
| Purpose | Support Live scoring and Match Status filters |
| Typical query pattern | Matches by category + status; live/warm_up subsets |
| Performance benefit | Low-latency Live Match lists and scoreboard feeds |
| Maintenance | High write churn on `matches`; keep indexes selective |

### Conflict Detection Indexes

| Aspect | Guidance |
| --- | --- |
| Purpose | Detect Court/time overlaps during scheduling |
| Typical query pattern | Schedule entries by `court_id` + `scheduled_start_at` |
| Performance benefit | Fast validation before Schedule Publish |
| Maintenance | Critical during Setup/Live reschedule bursts |

### Partial Indexes

| Aspect | Guidance |
| --- | --- |
| Purpose | Index only relevant subsets (live matches, active soft-delete uniques, one official version) |
| Typical query pattern | Active rows only; official_flag = true; live statuses |
| Performance benefit | Smaller indexes, stronger uniqueness semantics |
| Maintenance | Some require raw SQL migrations (see Prisma Implementation Notes) |

---

## Prisma Implementation Notes

This section describes conceptual Prisma mapping only. It does **not** generate a Prisma schema.

| PostgreSQL / Physical Concept | Prisma Mapping Concept |
| --- | --- |
| UUID | `String @id @default(uuid()) @db.Uuid` (or equivalent UUID default strategy aligned with `gen_random_uuid()`) |
| TIMESTAMPTZ | `DateTime @db.Timestamptz` |
| JSONB | `Json` |
| Enum | Prisma `enum` mapped to PostgreSQL enum |
| Foreign Key | `@relation(...)` with FK scalar field |
| Soft Delete | Nullable `deleted_at` / `deleted_by` fields; application filters |
| Composite Unique | `@@unique([fieldA, fieldB])` |
| Indexes | `@@index([fieldA, fieldB])` |

### Partial unique indexes

PostgreSQL partial unique indexes (examples from Section 11):

- unique active tournament name (`WHERE deleted_at IS NULL`)
- at most one official drawing/schedule/bracket version (`WHERE official_flag = true`)
- one active referee assignment (`WHERE assignment_status = 'active'`)

These require **SQL migration** support because Prisma does not fully support PostgreSQL partial unique indexes declaratively.

### Authority rule

This Physical Database Design remains the authoritative source whenever Prisma capabilities differ from PostgreSQL.

If Prisma cannot express a documented constraint declaratively, implement it in SQL migration while keeping the Prisma model as close as possible, and document the deviation before merge.

---

## 15. Relationship Mapping

| Logical Relationship | Physical Mapping |
| --- | --- |
| Tournament owns Categories | `categories.tournament_id` → `tournaments.id` |
| Tournament owns Courts | `courts.tournament_id` |
| Category owns Teams | `teams.category_id` |
| Team contains Players | `players.team_id` |
| Category owns Drawing | `drawings.category_id` unique |
| Drawing has Versions | `drawing_versions.drawing_id` |
| Drawing Version produces Groups | `groups.drawing_version_id` |
| Group contains Teams | `group_members` |
| Category owns Schedule | `schedules.category_id` unique |
| Schedule has Versions | `schedule_versions.schedule_id` |
| Schedule references Courts | `schedule_entries.court_id` |
| Category owns Matches | `matches.category_id` |
| Match participations | `match_participations` |
| Verified Match updates Standing | application transaction + `standings` rows |
| Category owns Playoff | `playoffs.category_id` unique |
| Playoff owns Bracket | `brackets.playoff_id` |
| Playoff derives Champion | `champions.playoff_id` unique |
| Match references Referee | `referee_assignments.match_id` |

---

## 16. Cascade Rules

Summary policy:

| Scenario | Rule |
| --- | --- |
| Delete parent with operational children (tournament→categories/matches) | **RESTRICT** |
| Delete pure dependent children (players under team, entries under version) | **CASCADE** |
| Optional references (court on match/entry) | **SET NULL** |
| Audit/event tournament context | **SET NULL** (preserve logs) |
| Official version pointer cycles | **SET NULL** on pointer; versions retained |

Never use CASCADE from Tournament to Matches in V1 — Archive/soft-delete and RESTRICT protect history.

---

## 17. Soft Delete Strategy

| Column | Meaning |
| --- | --- |
| deleted_at | Soft-deletion timestamp |
| deleted_by | Actor who soft-deleted |

**Uses soft delete**

`tournaments`, `categories`, `courts`, `teams`, `players`, `sponsors`, `galleries`, `gallery_items`

**Never soft delete**

`audit_logs`, `event_logs`, `drawing_versions`, `schedule_versions`, `brackets` (historical versions), `champions`, `reviews`, `group_members`, `match_participations`, `matches` (use status/flags), `referee_assignments` (status/unassigned_at)

Queries for mutable business lists must filter `deleted_at IS NULL` unless explicitly including deleted.

---

## 18. Audit Columns

Standard mutable-table audit columns:

- `created_at`
- `created_by`
- `updated_at`
- `updated_by`
- `deleted_at` / `deleted_by` where soft delete applies

Significant business actions also write `audit_logs` and `event_logs` per Business Rules.

---

## 19. Timestamp Strategy

| Concern | Decision |
| --- | --- |
| Type | `TIMESTAMPTZ` |
| Storage | UTC |
| created_at | set once on insert |
| updated_at | maintained on update (DB trigger or application) |
| Domain times | `scheduled_start_at`, `actual_start_at`, `published_at`, `occurred_at` |

---

## 20. Versioning Strategy

| Artifact | Table | Official pointer | Rules |
| --- | --- | --- | --- |
| Drawing | `drawing_versions` | `drawings.current_official_version_id` | Replay inserts new row; prior rows immutable; partial unique on official_flag |
| Schedule | `schedule_versions` | `schedules.current_official_version_id` | Regeneration inserts new row; history retained |
| Bracket / Playoff | `brackets` | `playoffs.current_official_bracket_id` | New versions on regenerate; match progression updates match rows, not rewrite of historical official structure without new version rules |
| Review | `reviews` | references `version_id` | One review decision record per review action |

Version lifecycle columns: `version_number`, `version_status`, `official_flag`, `generation_source`.

When a new Official Version is published, previous Official Version transitions to `historical` and `official_flag = false` inside the same transaction.

---

## 21. Transaction Strategy

| Business Operation | Transaction Boundary |
| --- | --- |
| Generate Drawing | Insert `drawing_versions` (+ optional candidate groups) in one TX; no publish |
| Publish Drawing | Review check → mark version official → update drawing pointer/publish/lock fields → audit/event |
| Generate Schedule | Insert `schedule_versions` + `schedule_entries` (+ match stubs as needed) in one TX |
| Publish Schedule | Conflict validation → official marker → schedule pointer → audit/event |
| Verify Match | Update match status/result → recompute affected `standings` → event/audit in one TX |
| Generate Playoff | Insert playoff/bracket candidates; no publish |
| Publish Bracket | Official bracket pointer + publish fields + audit |
| Declare Champion | Insert `champions` only if playoff completion rules satisfied + audit |
| Drawing Replay | Insert new version; never mutate prior version rows |

All Publish/Lock/Verify paths must write audit/event in the same transaction as state change.

---

## 22. Concurrency Strategy

**Optimistic concurrency** on mutable aggregates/entities:

- Column `row_version INTEGER NOT NULL DEFAULT 1`
- Update increments `row_version` and includes `WHERE row_version = :expected`
- On conflict, application retries or returns concurrency error

Also maintain `updated_at` for observability.

High-contention paths:

- Live match scoring (`matches.row_version`)
- Standing recalculation (`standings.row_version`)
- Publish/Lock on drawings/schedules/playoffs

Append-only tables (`audit_logs`, `event_logs`, versions) do not use optimistic overwrite; insert-only.

---

## 23. Migration Strategy

| Phase | Approach |
| --- | --- |
| Baseline | Initial Prisma migration creating enums + all V1 tables/constraints/indexes from this document |
| Incremental | Additive migrations preferred (new columns/indexes) |
| Breaking changes | Expand/contract with backward-compatible deploy steps |
| Naming | `YYYYMMDDHHMM_description` via Prisma migrate |
| Environments | migrate deploy in CI/CD; never manual prod DDL bypass |

Physical design changes require updating this document before migration authoring.

---

## 24. Seed Strategy

Seed reference enums are created as PostgreSQL enum types (not seed rows).

Optional seed data for non-prod:

| Seed | Content |
| --- | --- |
| Demo tournament | One Draft/Setup tournament for QA |
| Demo courts | Sample courts |
| Roles/users | Outside DB enums; identity provider seed separate |

Enum values seeded by schema creation:

- TournamentStatus / MatchStatus / Visibility / LockState / PublishState / VersionStatus / ReviewStatus / related enums in Section 13

No production fake competition results in baseline seed.

---

## 25. Performance Considerations

| Pattern | Tables | Notes |
| --- | --- | --- |
| Read-heavy public views | matches, standings, brackets, schedule_entries | Index for category + status; consider read replicas later |
| Write-heavy live scoring | matches, match_participations, standings, event_logs | Keep TX short; optimistic concurrency |
| Version history reads | drawing_versions, schedule_versions, brackets | Indexed by parent id |
| Audit inspection | audit_logs, event_logs | (tournament_id, occurred_at DESC) |
| Conflict detection | schedule_entries | (court_id, scheduled_start_at) |

JSONB used sparingly (`score_representation`, `structure_representation`, `configuration`) to avoid over-normalization of opaque structures while keeping relational integrity for ownership.

---

## 26. Security Considerations

| Concern | Approach |
| --- | --- |
| Sensitive data | Minimal PII in V1 player display names; no payment data |
| Audit protection | No soft delete / no update of audit_logs and event_logs |
| Soft delete | Prevent accidental hard delete of tournaments/categories |
| Access control | Enforced in application (NestJS); DB roles least-privilege |
| Media references | `gallery_items.media_reference` stores reference, not public unauthenticated write path |
| SQL injection | Parameterized Prisma queries only |

---

## 27. Backup Considerations

| Item | Guidance |
| --- | --- |
| RPO/RTO | Align with Live event criticality (NFR availability) |
| What must survive | Official versions, matches verified results, standings, champions, audit/event logs |
| Method | PostgreSQL managed backups + point-in-time recovery |
| Pre-event | Snapshot before Live tournaments |
| Restore test | Periodic restore drills including enum/type compatibility |

---

## Future Read Models (Roadmap)

This section is informational only. It does **not** change the V1 physical schema.

Potential future read models:

- Live Scoreboard
- TV Display
- Public Tournament Page
- Standings Dashboard
- Tournament Statistics
- Mobile Read API

These may later use one or more of:

- SQL Views
- Materialized Views
- Read-only projections
- CQRS read models

**Explicit V1 boundary:** Future Read Models are **not** part of V1. V1 serves Public Viewer / TV Display needs from the relational tables and application read paths defined by existing architecture documents, without dedicated read-model tables in this design.

---

## Implementation Principles

1. **Physical Database Design is the single source of truth** for persistence structure.
2. **Prisma Schema must be generated from this document**, not invented ad hoc in code.
3. **SQL migrations must preserve all documented constraints**, including those requiring raw SQL (especially partial unique indexes).
4. **Application code must never bypass database integrity rules** (no disabling FKs/checks in production paths).
5. **Business Rules remain enforced primarily by the application layer**, while the database enforces structural integrity (keys, uniqueness, referential integrity, local checks).
6. **Document any deviation before implementation** when tooling limits (Prisma/PostgreSQL feature gaps) require an alternate expression of the same physical intent.
7. **JSONB policy is mandatory** — authoritative core entities remain relational.
8. **No silent schema drift** — changes to tables/columns/constraints require updating this document first.

---

## 28. Traceability

```text
Business Architecture
↓
Conceptual Data Model
↓
Logical ERD
↓
Physical Database Design (this document)
↓
Prisma Schema
↓
REST API
↓
WebSocket
↓
Backend
↓
Frontend
```

Prisma schema and migrations must derive from this document without redefining business meaning.

---

## 29. Document Summary

| Metric | Count |
| --- | --- |
| Total Tables | 26 |
| Total Columns (approx.) | 320 |
| Total Foreign Keys | 40 |
| Total Unique Constraints | 22 |
| Total Check Constraints | 13 |
| Total Indexes (named beyond PK) | 27 |
| Total Enums | 17 |
| Allowed JSONB Columns | 4 |
| Index Classification Groups | 7 |

Schema metrics are unchanged from v0.1.0. v0.1.1 adds implementation guidance only.

---

## 30. Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Principal Database Architect | Initial Physical Database Design for PostgreSQL 17+ / Prisma, derived from Logical ERD v0.1.1 |
| 0.1.1 | 2026-07-25 | Principal Database Architect | Enterprise implementation guidance added: JSON Storage Policy, Index Classification, Prisma Implementation Notes, Future Read Models, Implementation Principles. No physical schema changes. |

---

*This Physical Database Design is the authoritative persistence blueprint for Set Point. Prisma schema, SQL migrations, and backend repositories must conform to the tables, columns, constraints, indexes, enums, and strategies defined herein without redefining business meaning.*
