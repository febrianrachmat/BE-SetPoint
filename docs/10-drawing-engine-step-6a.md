# Step 6A — Drawing Generation (Technical Design)

| Field | Value |
| --- | --- |
| Document | Drawing Engine — Step 6A Technical Design |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Design Locked — Implemented (6A) |
| Last Updated | 2026-07-28 |
| Depends On | `02-domain-model.md`, `03-business-rules.md`, `04-tournament-engine-specification.md`, `08-physical-database-design.md`, `09-prisma-schema-specification.md` |
| Out of Scope | Publish / Official (6B), Lock (6C), Match / Schedule (7) |

---

## 1. Purpose

Step 6A implements the **Drawing Generation** capability:

- Place eligible Teams into Groups for one Category
- Persist a **candidate** `DrawingVersion` with Groups and GroupMembers
- Guarantee reproducibility via Drawing Seed
- **Do not** create Matches, ScheduleEntries, Publish, Lock, or Official pointers

This step is the foundation for Schedule, Standing, Playoff, and Live Scoring.

---

## 2. Locked Design Decisions

### 2.1 Participant source of truth

```text
Category
  → Registered Teams (active, not soft-deleted)
    → Eligible Teams
      → Drawing placements
```

**Eligible Team** (all must hold):

| Check | Rule |
| --- | --- |
| `deletedAt IS NULL` | Soft-deleted excluded |
| `status = active` | Withdrawn status excluded |
| `withdrawalFlag = false` | TEAM-07 / EX-05 |
| `eligibilityStatus = eligible` | TEAM-03 / TEAM-04 (composition vs `configuration.teamSize`) |

Player-level composition is already enforced by Category/Team registration (Step 5B). Drawing consumes the resulting `eligibilityStatus`; it does not re-implement player rules unless a defensive recount is desired.

### 2.2 Generation gates (may generate?)

Separate from eligibility:

| Gate | MVP rule |
| --- | --- |
| Tournament status | `setup` **or** `published` |
| Drawing lock | `lockState ≠ locked` (no Drawing row ⇒ unlocked) |
| Category soft-delete | Category must be active |
| Eligible count vs config | Exact partition required (see §2.3) |

**Note:** Tournament `published` is **not** required to generate a candidate (EO may preview draws in Setup). Publishing the Drawing itself is Step 6B and may require stricter tournament state.

### 2.3 Group partition (from Category configuration)

Required keys in `Category.configuration` (JSONB):

```json
{
  "teamSize": 2,
  "groupCount": 4,
  "teamsPerGroup": 4
}
```

| Field | Meaning |
| --- | --- |
| `teamSize` | Players per team (eligibility; owned by registration) |
| `groupCount` | Number of Groups to create |
| `teamsPerGroup` | Members per Group |

**Exact partition (MVP):**

```text
eligibleTeamCount === groupCount × teamsPerGroup
```

If not equal → reject generation (`DRAW-02`). No uneven groups in MVP.

Examples:

| Eligible | Config | Result |
| --- | --- | --- |
| 8 | `groupCount=2`, `teamsPerGroup=4` | OK — A,B |
| 12 | `groupCount=4`, `teamsPerGroup=3` | OK |
| 16 | `groupCount=4`, `teamsPerGroup=4` | OK |
| 10 | `groupCount=2`, `teamsPerGroup=4` | Reject |

Group names: `Group A`, `Group B`, … (Latin letters). Optional `label` = same letter.

### 2.4 Placement modes vs Drawing Seed

Two **different** concepts (DRAW-05):

| Concept | Field / API | Meaning |
| --- | --- | --- |
| **Drawing Seed** | `DrawingVersion.drawingSeed` | Reproducibility input for deterministic generation |
| **Placement mode** | request `placementMode` | How teams are ordered into groups |

```text
placementMode: RANDOM | SEEDED
```

| Mode | Behavior |
| --- | --- |
| `RANDOM` | Deterministic shuffle of eligible team IDs using `drawingSeed`, then fill groups sequentially |
| `SEEDED` | Order by `Team.seedRank` ascending (nulls last / rejected if missing — see §3), then **snake draft** into groups |

**Snake draft (SEEDED):** for groups `[A,B,C,D]`:

```text
1→A, 2→B, 3→C, 4→D, 5→D, 6→C, 7→B, 8→A, …
```

`drawingSeed` is **always** stored on the version (even for SEEDED) for audit / replay metadata. For SEEDED, placement does not depend on shuffling by seed; regeneration with the same seedOrder/ranks must still yield the same groups.

### 2.5 Match creation

**Forbidden in 6A.** Matches are produced by Schedule Engine (Step 7) from official/candidate Groups.

Deliverable graph:

```text
Drawing
  └── DrawingVersion (candidate)
        ├── Group[]
        └── GroupMember[]
```

### 2.6 Versioning boundary (6A vs 6B)

| Action | Step |
| --- | --- |
| Ensure Drawing row exists | 6A |
| Create `DrawingVersion` with `versionStatus=candidate`, `officialFlag=false` | 6A |
| Validate & persist Groups / GroupMembers | 6A |
| Review / Publish / set Official pointer | **6B** |
| Lock / freeze registration | **6C** |

Regenerate = new version number (`N+1`). Prior versions and their Groups/GroupMembers remain (DRAW-09). Do **not** mutate prior version rows.

---

## 3. Schema adjustments for 6A

### 3.1 Required for SEEDED (recommended before/with 6A)

Add to `Team`:

```prisma
seedRank Int? @map("seed_rank")
```

Rules:

- Unique among active teams in a Category when not null (partial unique SQL preferred)
- `SEEDED` generation requires every eligible team to have non-null `seedRank`
- `RANDOM` ignores `seedRank`

Optional API in Team module (small follow-up in 6A or tiny 5B patch): `PATCH` team to set `seedRank`.

### 3.2 Persistence on `DrawingVersion` (schema additions)

| Column | Type | MVP | Purpose |
| --- | --- | --- | --- |
| `placementMode` | `VarChar(20)` — `random` \| `seeded` | **Required** | Placement strategy used for this version |
| `prngAlgorithm` | `VarChar(50)?` | **Required for RANDOM** | Exact PRNG implementation id, e.g. `mulberry32-v1` |
| `engineVersion` | `VarChar(50)` | **Required** | Drawing engine build id, e.g. `drawing-engine-v1` |
| `generationDurationMs` | `Int?` | Optional | Wall-clock duration of generation (ops / audit) |

**Why `prngAlgorithm` (locked):** DRAW-04 reproducibility must survive future algorithm changes. Years later, replay of an old version must select the **same** PRNG implementation. Changing the live default to `mulberry32-v2` must not break historical replay.

Rules:

- `RANDOM` → always set `prngAlgorithm` (MVP default: `mulberry32-v1`)
- `SEEDED` → `prngAlgorithm = null` (PRNG not used for placement; ranks + snake draft define outcome)
- `engineVersion` → always set from a code constant (`DRAWING_ENGINE_VERSION`)
- Do **not** overload `generationSource` (`engine` vs manual) with algorithm/version metadata

`generationDurationMs` is cheap and recommended to store on the row (not only in events) so history remains queryable without an event store. Not a functional dependency of Schedule/Standing.

### 3.3 No Match / Schedule schema changes

None for 6A.

---

## 4. Algorithm

### 4.1 Inputs

- `tournamentId`, `categoryId`
- `placementMode`
- Optional `drawingSeed` (if omitted → generate cryptographically strong string, store it)
- Actor (`createdBy`)

### 4.2 Steps

1. Load active Category in Tournament; parse & validate configuration
2. Load / assert generation gates
3. Ensure `Drawing` exists for Category (create if missing, unlocked/unpublished)
4. Reject if Drawing is locked
5. Load eligible teams (ordered for deterministic tie-breaks: `seedRank ASC NULLS LAST`, then `createdAt ASC`, then `id ASC`)
6. Assert `count === groupCount * teamsPerGroup`
7. If `SEEDED`: assert all eligible have `seedRank`; order by `seedRank`
8. If `RANDOM`: shuffle eligible IDs with seeded PRNG from `drawingSeed`
9. Allocate to groups (sequential fill for RANDOM; snake for SEEDED)
10. In one transaction:
    - Insert `DrawingVersion` (`versionNumber = max+1`, `candidate`, seed, placementMode, `prngAlgorithm`, `engineVersion`, optional `generationDurationMs`)
    - Insert `Group` rows bound to that version
    - Insert `GroupMember` rows (`placementOrder` 1..N within group)
11. Publish domain event `drawing.version_generated`
12. Return version detail (groups + members + teams)

### 4.3 Reproducibility (DRAW-04)

Same inputs must yield same placements:

- Same eligible team set (ids)
- Same `drawingSeed`
- Same `placementMode`
- Same `prngAlgorithm` (for RANDOM)
- Same `engineVersion` semantics for that algorithm (documented; breaking changes bump id)
- Same config (`groupCount`, `teamsPerGroup`)
- Same seed ranks (for SEEDED)

Implementation note: MVP PRNG = `mulberry32-v1` (xmur3 hash of seed string → mulberry32). Record id on the version row. Never silently change behavior under the same `prngAlgorithm` string — ship a new id (`mulberry32-v2`) instead.

### 4.4 Validation matrix (reject before write)

| Code / condition | HTTP | Message intent |
| --- | --- | --- |
| Tournament not found / deleted | 404 | Tournament not found |
| Category not in tournament | 404 | Category not found |
| Tournament status ∉ {setup, published} | 400 | Generation not allowed in status X |
| Drawing locked | 400 | Drawing is locked (DRAW-10/11) |
| Missing/invalid `groupCount` / `teamsPerGroup` | 400 | Invalid configuration invalid |
| Insufficient / non-exact eligible count | 400 | DRAW-02 partition failure |
| SEEDED with missing `seedRank` | 400 | Seed ranks required |
| Duplicate team in allocation (bug) | 500 | Invariant violated |

Post-write invariants (assert in service before commit or immediately after in tests):

- Every eligible team appears **exactly once** across GroupMembers of the version
- No ineligible / withdrawn team appears
- Each group has exactly `teamsPerGroup` members
- Group count equals `groupCount`

---

## 5. API surface (MVP)

Auth: same as Tournament — `JwtAuthGuard` + `AuthorizationGuard` + `tournament:manage`.  
Nest under tournament for scoped RBAC (`tournamentId` param).

Base:

```text
/api/v1/tournaments/:tournamentId/categories/:categoryId/drawing
```

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Get Drawing header (create-on-read **or** 404 if none — prefer ensure-on-generate only; GET returns 404 if never generated) |
| POST | `/generate` | Generate new candidate version |
| GET | `/versions` | List versions (number, status, seed, placementMode, createdAt) |
| GET | `/versions/:versionId` | Version detail + groups + members (+ team summary) |

### 5.1 `POST /generate` body

```json
{
  "placementMode": "random",
  "drawingSeed": "optional-explicit-seed"
}
```

Response: full candidate version payload (not published).

### 5.2 Explicitly out of 6A routes

- Publish / unpublish
- Set official
- Lock / unlock
- Manual placement edit (DRAW-13 → later; optional 6B)
- Match generation

---

## 6. Module layout

Mirror Tournament / Category patterns:

```text
src/drawing/
  drawing.module.ts
  drawing.controller.ts
  drawing.service.ts
  drawing.repository.ts
  drawing.events.ts
  drawing.lifecycle.ts          # gates only in 6A; publish/lock stubs deferred
  dto/
    generate-drawing.dto.ts
  engine/
    drawing-generator.ts        # pure placement algorithm (unit-testable)
    seeded-prng.ts              # deterministic shuffle
    group-partition.ts          # config parse + exact partition check
    snake-draft.ts              # SEEDED allocation
```

**Dependency rules:**

- `drawing-generator.ts` is pure (no Prisma) — inputs in, placements out
- Repository owns Prisma transactions
- Service owns gates, eligibility query, events
- CategoryModule / Team services: inject only what is needed (or query via Prisma in DrawingRepository for eligibility to avoid circular DI)

Import `DrawingModule` in `AppModule`.

---

## 7. Domain events (6A)

| Event | When |
| --- | --- |
| `drawing.ensured` | First Drawing row created for Category |
| `drawing.version_generated` | Candidate version persisted |

Payload minimum: `tournamentId`, `categoryId`, `drawingId`, `drawingVersionId`, `versionNumber`, `placementMode`, `drawingSeed`, `prngAlgorithm`, `engineVersion`, `generationDurationMs`, `eligibleCount`, `groupCount`, `actorId`.

Publish/Lock events belong to 6B/6C.

---

## 8. Interaction with existing 5B rules

Already encoded (soft):

- Team soft-delete / registration blocked when Drawing published or locked

6A does **not** set publish/lock. Until 6B/6C:

- Regeneration remains allowed while unlocked
- Registration remains open (by design) until Lock

After 6C, existing 5B checks become fully meaningful.

---

## 9. Test plan (before calling 6A done)

### Unit

- Exact partition accept/reject
- RANDOM: same seed → same placements; different seed → (likely) different
- SEEDED snake draft golden cases (8→2×4, 16→4×4)
- Eligible filter excludes withdrawn / ineligible / deleted

### Integration (API)

- Generate on Setup tournament with 8 eligible teams
- Second generate increments `versionNumber`; version 1 intact
- Reject when only 7 eligible
- Reject when Drawing locked (simulate lock row in test / skip until 6C with direct DB)
- Response contains groups + members; zero Match rows created

### Non-goals for 6A tests

- Official pointer
- Public visibility
- Schedule conflicts

---

## 10. Implementation sequence

1. Schema migration: `Team.seedRank`; on `DrawingVersion`: `placementMode`, `prngAlgorithm`, `engineVersion`, `generationDurationMs`
2. Pure engine utilities + unit tests
3. Repository + Service + Controller
4. Wire module; Swagger
5. Seed demo: optional generate after seed **or** leave for manual API (prefer API-only first)
6. README: document Drawing API + roadmap 6A→6C→7
7. Stop — do not start 6B until 6A green

---

## 11. Roadmap reminder

```text
6A Drawing Generation     ← this document
  → 6B Drawing Versioning (Publish, Official, History UX)
  → 6C Drawing Lock (freeze registration / category)
  → 7  Schedule Generation (Match + ScheduleEntry)
  → 8  Live Match Engine
  → 9  Standing Engine
  → 10 Playoff Engine
```

---

## Appendix A — Step 6B Versioning (implemented)

Flow:

```text
Candidate Version
  → Review (approve | reject)
  → Publish (only if approved)
  → Official (Drawing.currentOfficialVersionId)
```

Rules enforced:

- REV-02/03: Review required before Publish; Review ≠ Official
- DRAW-07 / PUB-05: Engine never auto-publishes
- VER-03: Only one official version; previous → `historical`
- PUB-07 / DRAW-09: History preserved; versions are never rewritten
- PUB-08: Publish ≠ Lock (Lock is Step 6C)
- After Publish, registration soft-gates in Team module activate via `publishState=published`

API:

- `POST .../versions/:versionId/review`
- `POST .../versions/:versionId/publish`
- `GET .../official`

---

## Appendix B — Step 6C Lock (implemented)

Flow:

```text
Published Official Drawing
  → Lock
  → (exception) Unlock(reason) → correct → re-Lock
```

Effects while locked:

- Generate / Review / Publish forbidden (DRAW-10/11)
- Team registration & soft-delete forbidden (existing published/locked gate)
- Team withdraw forbidden
- Category + official Groups `lockState=locked`
- Category structural changes / delete remain blocked via artifact checks

Unlock requires mandatory `reason` (LOCK-07) and emits `drawing.unlocked`.

---

## Appendix C — Schedule Ready (conceptual; for Step 7)

**Not a database field.** Documented invariant only.

Schedule Generation is allowed **only if**:

```text
Drawing.publishState = published
  AND Drawing.lockState = locked
  AND Drawing.currentOfficialVersionId is set
```

Rationale:

- Publish alone still allows exceptional regenerate/review paths until Lock (PUB-08)
- Lock makes placements operationally binding (LOCK-01/04)
- Schedule Engine must not reason about many state combinations

Implementation helper (code):

- `isScheduleReady(drawing)` in `src/drawing/drawing.lifecycle.ts`
- `DrawingService.assertScheduleReady(tournamentId, categoryId)` for Step 7 to call

Step 7 should depend on this gate, then consume the Official DrawingVersion Groups/GroupMembers to create Matches + ScheduleEntries.

### Step 7 API shape (locked)

Schedule **must not** accept `drawingVersionId` from the client.

```http
POST /api/v1/tournaments/:tournamentId/categories/:categoryId/schedule/generate
```

Internal resolution only:

```text
DrawingService.assertScheduleReady()
  → Drawing.currentOfficialVersionId
  → Official Groups / GroupMembers
  → Schedule generation
```

Rationale: prevents accidental Schedule generation from a **candidate** version. The only legal input set is the Official Drawing after Lock.

Step 6A is complete when:

1. Admin can generate a candidate DrawingVersion for a Category in Setup/Published
2. Only eligible teams are placed; each exactly once
3. Groups match `groupCount` × `teamsPerGroup`
4. `RANDOM` and `SEEDED` behave as specified
5. `drawingSeed` + `prngAlgorithm` + `engineVersion` stored; RANDOM is reproducible via the recorded algorithm id
6. Regeneration creates a new version without destroying history
7. **No** Match / Schedule / Publish / Lock side effects
8. `nest build` passes; unit tests cover the pure generator
