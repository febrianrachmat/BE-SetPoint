# Conceptual Data Model

| Field | Value |
| --- | --- |
| Document | Conceptual Data Model |
| Product | Set Point |
| Version | 0.1.2 |
| Status | Foundation Sprint |
| Classification | Internal — Conceptual Data Architecture |
| Last Updated | 2026-07-25 |
| Depends On | `00-project-charter.md`, `01-product-glossary.md`, `02-domain-model.md`, `03-business-rules.md`, `04-tournament-engine-specification.md`, `05-software-requirements-specification.md` |

---

## Purpose

The Conceptual Data Model (CDM) defines the highest-level business information concepts of Set Point and how those concepts relate.

It bridges Business Architecture and later database design without becoming a database design itself.

**Layer differences**

| Layer | Responsibility |
| --- | --- |
| Business Domain Model | Business entities, Aggregate Roots, ownership, domain boundaries |
| **Conceptual Data Model** | **Business information concepts and relationships as data meaning** |
| Logical ERD | Normalized logical data structures derived from this CDM |
| Physical Database Design | Tables, keys, indexes, storage, and persistence technology |

This document does not define attributes, keys, data types, tables, Prisma models, SQL, APIs, or implementation.

Terminology, ownership, Business Rules, and Tournament Engine boundaries remain authoritative in their foundation documents and are not redefined here.

---

# Modeling Principles

1. **Business First** — Model business meaning, not storage.
2. **Technology Independent** — No database, ORM, cache, or API concepts.
3. **Ownership Driven** — Every concept respects Aggregate ownership from the Domain Model.
4. **Immutable History** — Official and historical meaning is preserved.
5. **Audit Friendly** — Significant conceptual changes are accountable.
6. **Version Aware** — Generated artifacts support version meaning.
7. **Aggregate Respect** — Conceptual relationships do not break Tournament and Category consistency boundaries.
8. **No Database Concepts** — No tables, schemas, or persistence patterns.
9. **No Primary Keys** — Identity is business identity, not technical key design.
10. **No Foreign Keys** — Relationships are business relationships, not join constraints.
11. **No Data Types** — No fields, columns, enums-as-storage, or scalar typing.
12. **Read/Write Separation** — Ownership is independent from presentation.
13. **Event Awareness** — Business events represent conceptual business occurrences without defining implementation technology.

---

# Core Business Concepts

Conceptual entities below describe business information meaning only. Attributes are intentionally omitted.

---

## Tournament

**Purpose**

Highest-level business container for a single competitive padel event.

**Business Responsibility**

Bound the event lifecycle and own tournament-level resources and Categories.

**Business Owner**

Top-level Aggregate Root (platform-created business scope).

**Lifecycle**

Draft → Setup → Published → Live → Finished → Archived.

**Major Relationships**

Owns Categories, Courts, Sponsors, Gallery, Audit Log context, Event Log context.

---

## Category

**Purpose**

Competitive division within a Tournament.

**Business Responsibility**

Own competition structure and Category consistency for Teams, Drawing, Groups, Matches, Schedule, Standings, and Playoff.

**Business Owner**

Tournament.

**Lifecycle**

Created during Tournament preparation; progresses through competition generation and play within Tournament Lifecycle constraints.

**Major Relationships**

Owned by Tournament; owns Teams, Drawing, Groups, Matches, Schedule, Standings, Playoff.

---

## Court

**Purpose**

Playable venue resource of a Tournament.

**Business Responsibility**

Provide location meaning for scheduling and live play.

**Business Owner**

Tournament.

**Lifecycle**

Configured during Setup; referenced during Published/Live operations; retained historically with Tournament.

**Major Relationships**

Owned by Tournament; referenced by Schedule and Match scheduling decisions.

---

## Team

**Purpose**

Primary competing unit registered in a Category.

**Business Responsibility**

Represent the side that enters Drawing, Matches, Standings, and Playoff.

**Business Owner**

Category.

**Lifecycle**

Registration → eligibility → participation → possible withdrawal; retained in Category history.

**Major Relationships**

Owned by Category; composed of Players; participates in Groups/Matches/Standings/Playoff.

---

## Player

**Purpose**

Individual participant assigned to a Team.

**Business Responsibility**

Identify people in Team composition and Match participation context.

**Business Owner**

Team composition within Category.

**Lifecycle**

Assigned/replaced under Team rules; retained in historical Team composition meaning.

**Major Relationships**

Belongs to Team composition; indirectly related to Category through Team.

---

## Group

**Purpose**

Preliminary pool subdivision of Teams within a Category.

**Business Responsibility**

Structure group-stage competition and contain group-stage Matches.

**Business Owner**

Category.

**Lifecycle**

Produced from Drawing; used through group-stage play; protected after Lock/Verified history.

**Major Relationships**

Derived from Drawing; contains Teams and group-stage Matches; feeds Standings context.

---

## Drawing

**Purpose**

Generated Business Artifact recording Team placement into Groups.

**Business Responsibility**

Provide reproducible, reviewable, publishable, lockable group-placement meaning.

**Business Owner**

Category.

**Lifecycle**

Generated → Reviewed → Published (Official) → optionally Locked; Replay creates new Version.

**Major Relationships**

Owned by Category; uses Drawing Seed meaning; produces Groups; versioned and auditable.

---

## Schedule

**Purpose**

Generated Business Artifact owning scheduling decisions for Category Matches.

**Business Responsibility**

Define when Matches occur and which Tournament Court each Match references.

**Business Owner**

Category.

**Lifecycle**

Generated → Reviewed → Published → optionally Locked; Regeneration creates new Version; Reschedule is audited change.

**Major Relationships**

Owned by Category; references Courts; plans Matches; never owns Courts.

---

## Match

**Purpose**

Atomic competitive contest within a Category.

**Business Responsibility**

Carry Match Status progression and official result meaning after Verification.

**Business Owner**

Category Aggregate (structurally under Group or Playoff).

**Lifecycle**

Waiting → Warm Up → Live → Finished → Verified (plus cancel/abandon exception paths).

**Major Relationships**

Belongs to Category; belongs to Group or Playoff stage; references Court via Schedule; may reference Referee assignment; Verified results update Standings.

---

## Standing

**Purpose**

Ranked competitive position meaning derived from Verified Match results.

**Business Responsibility**

Reflect performance and support Playoff qualification.

**Business Owner**

Category.

**Lifecycle**

Updates on Verify; may be recalculated; may be Published/Locked.

**Major Relationships**

Depends on Verified Matches; contextualized by Groups; qualifies Teams for Playoff.

---

## Playoff

**Purpose**

Post-group competition stage of a Category.

**Business Responsibility**

Define final-stage competition path leading to Champion.

**Business Owner**

Category.

**Lifecycle**

Generated from qualification → Reviewed → Published → Locked as required; progresses through playoff Matches.

**Major Relationships**

Depends on Standings qualification; owns Bracket; owns playoff-stage Matches; derives Champion.

---

## Bracket

**Purpose**

Structured map of Playoff Match progression.

**Business Responsibility**

Represent advancement path to Champion.

**Business Owner**

Playoff (within Category).

**Lifecycle**

Generated with Playoff → Reviewed → Published → advances from Verified playoff Matches.

**Major Relationships**

Depends on Playoff; associated with playoff Matches; leads to Champion.

---

## Sponsor

**Purpose**

Tournament-level commercial/presentation association.

**Business Responsibility**

Belong to Tournament presentation context for public/TV surfaces.

**Business Owner**

Tournament.

**Lifecycle**

Configured with Tournament; retained historically with Tournament.

**Major Relationships**

Owned by Tournament; presented through Public Viewer/TV Display meaning.

---

## Gallery

**Purpose**

Tournament-owned media collection.

**Business Responsibility**

Hold event media for presentation and historical retention.

**Business Owner**

Tournament.

**Lifecycle**

Managed during Tournament life; retained when Archived per rules.

**Major Relationships**

Owned by Tournament; consumed by public presentation meaning.

---

## Audit Log

**Purpose**

Authoritative accountability record of significant business actions.

**Business Responsibility**

Capture who changed what and when at business-meaningful level.

**Business Owner**

Tournament context.

**Lifecycle**

Append-oriented through Tournament life and Archive retention.

**Major Relationships**

Related to controlled actions on Tournament/Category artifacts (Publish, Lock, Replay, Verify, exceptions, etc.).

---

## Event Log

**Purpose**

Chronological record of meaningful domain occurrences.

**Business Responsibility**

Provide operational timeline of what happened.

**Business Owner**

Tournament context.

**Lifecycle**

Append-oriented through Tournament life and Archive retention.

**Major Relationships**

Complements Audit Log; records occurrences such as Match Started, Standing Updated, Champion Declared.

---

## Engine Artifact (conceptual only)

**Purpose**

Conceptual class of outputs produced by the Tournament Engine.

**Business Responsibility**

Represent generated candidates/artifacts (Drawing, Groups, Schedule, Standings calculations, Playoff, Bracket) before/when they become official business artifacts.

**Business Owner**

Never owned by Engine; owned by the Aggregate that receives them (normally Category).

**Lifecycle**

Generated → versioned → Reviewable → optionally Official via Publish.

**Major Relationships**

Produced by Tournament Engine capability; consumed by Review/Publish/Lock concepts.

---

## Version (conceptual)

**Purpose**

Business meaning of a distinct generation of a version-aware artifact.

**Business Responsibility**

Distinguish Official Version from historical versions; preserve immutability of older versions.

**Business Owner**

Follows the owning Aggregate of the versioned artifact.

**Lifecycle**

Created by Generation, Replay, or Regeneration; at most one Official Version.

**Major Relationships**

Applies to Drawing, Schedule, Playoff, Bracket (and related generated outcomes).

---

## Review

**Purpose**

Formal business examination of required Engine-generated artifacts.

**Business Responsibility**

Gate approval before Publish; does not make artifacts official; does not change ownership.

**Business Owner**

Performed by Tournament Admin over Aggregate-owned artifacts.

**Lifecycle**

Pending → Approved or Rejected; rejection preserves history and allows regenerate/edit then re-Review.

**Major Relationships**

Applies to Drawing, Schedule, Playoff (required); precedes Publish.

---

## Publish State

**Purpose**

Business state/action meaning that an artifact (or Tournament lifecycle) is official for intended consumers.

**Business Responsibility**

Create Official Version for consumption by Tournament Admins, Referees, Public Viewer, and TV Display as applicable.

**Business Owner**

Controlled by Tournament Admin; state belongs with the published concept’s Aggregate.

**Lifecycle**

Unpublished/internal → Published/Official.

**Major Relationships**

Follows Review where required; distinct from Lock; related to Official Version.

---

## Lock State

**Purpose**

Business integrity state preventing unrestricted modification.

**Business Responsibility**

Protect operationally binding artifacts; Unlock is exceptional and audited.

**Business Owner**

Controlled by Tournament Admin; state belongs with the locked concept’s Aggregate.

**Lifecycle**

Unlocked/editable (within rules) → Locked; exceptional Unlock → corrective work → re-Lock.

**Major Relationships**

Applies to Drawing, Schedule, Groups/Playoff structure, and related integrity-sensitive artifacts.

---

## Champion (conceptual outcome)

**Purpose**

Official competitive outcome of a completed Playoff.

**Business Responsibility**

Mark Category winner meaning after Playoff completion.

**Business Owner**

Derived from Playoff (Category).

**Lifecycle**

Exists only after successful Playoff completion; no independent lifecycle.

**Major Relationships**

Derived from Playoff/Bracket completion; contributes to Tournament Finished readiness.

---

## Referee Assignment (conceptual reference)

**Purpose**

Operational assignment meaning linking a Referee role to a Match.

**Business Responsibility**

Authorize Match scoring/operation scope for that Referee.

**Business Owner**

Category/Tournament operational context (assignment controlled by Tournament Admin).

**Lifecycle**

Assignable from Published onward; auditable.

**Major Relationships**

Match references Referee assignment; does not transfer Match ownership.

---

# Relationship Model

Business relationships (wording only):

- Tournament owns Categories.
- Tournament owns Courts.
- Tournament owns Sponsors.
- Tournament owns Gallery.
- Tournament owns Audit Log and Event Log context.
- Category belongs to exactly one Tournament.
- Category owns Teams.
- Team belongs to exactly one Category.
- Team is composed of Players.
- Category owns Drawing.
- Drawing produces Groups.
- Category owns Groups.
- Groups contain group-stage Matches.
- Category owns Matches.
- Match belongs to exactly one Category.
- Match belongs to either a Group or a Playoff stage.
- Category owns Schedule.
- Schedule owns scheduling decisions.
- Schedule references Courts.
- Schedule never owns Courts.
- Match may reference a Court through Schedule.
- Match may reference a Referee assignment.
- Verified Matches update Standings.
- Category owns Standings.
- Standings qualify Teams for Playoff.
- Category owns Playoff.
- Playoff produces Bracket.
- Playoff owns playoff-stage Matches.
- Bracket leads to Champion.
- Playoff derives Champion.
- Tournament Engine generates Engine Artifacts but owns nothing.
- Review examines Engine Artifacts without changing ownership.
- Publish creates Official Version.
- Lock protects Official/operational integrity.
- Versioning preserves historical Versions as immutable.

---

# Aggregate Ownership

Ownership tree (text only):

```text
Tournament (Aggregate Root)
├── Courts
├── Sponsors
├── Gallery
├── Audit Log (context)
├── Event Log (context)
└── Category (Aggregate Root)
    ├── Teams
    │   └── Players (composition)
    ├── Drawing
    │   └── Versions / Drawing Seed meaning
    ├── Groups
    │   └── group-stage Matches
    ├── Schedule
    │   └── scheduling decisions (references Courts)
    ├── Matches (Category consistency boundary)
    ├── Standings
    └── Playoff
        ├── Bracket
        ├── playoff-stage Matches
        └── Champion (derived outcome)
```

Match is an Entity inside the Category Aggregate, not an Aggregate Root.

Tournament Engine is outside this tree and owns none of it.

---

# Lifecycle Relationships

Competition information flow through the business lifecycle:

```text
Tournament
↓
Category
↓
Teams / Players
↓
Drawing
↓
Groups
↓
Schedule
↓
Matches
↓
Standings
↓
Playoff
↓
Bracket
↓
Champion
↓
Tournament Finished
↓
Tournament Archived
```

Control concepts overlay this flow:

```text
Generate (Engine Artifact / Version)
↓
Review
↓
Publish (Official Version / Publish State)
↓
Lock (Lock State)
```

Live operations overlay Matches:

```text
Waiting → Warm Up → Live → Finished → Verified → Standing update
```

---

# Business Reference Model

Differentiate relationship kinds:

### Ownership

Parent Aggregate/entity owns child concept and consistency.

Examples:

- Tournament owns Categories.
- Category owns Matches.
- Category owns Drawing.
- Tournament owns Courts.

### Reference

One concept points to another without owning it.

Examples:

- Schedule references Court.
- Match references Court through Schedule.
- Match references Referee assignment.

### Dependency

One concept requires another’s prior official/valid meaning.

Examples:

- Bracket depends on Playoff.
- Standings depend on Verified Matches.
- Playoff depends on qualification Standings.
- Groups depend on Drawing.

### Generation

Tournament Engine produces a concept inside an ownership boundary.

Examples:

- Drawing generates Groups.
- Engine generates Schedule.
- Engine generates Playoff and Bracket.
- Engine calculates Standings.

Generation never transfers ownership to the Engine.

---

# Versioned Concepts

Version-aware concepts:

- Drawing
- Schedule
- Playoff
- Bracket
- Related generated Group structure tied to Drawing history
- Standing recalculation outcomes where treated as versioned/audited regeneration
- Review outcomes associated with candidate Versions
- Publish State designation of Official Version
- Lock State applied to a Version/artifact

Version rules (conceptual):

- Regeneration/Replay creates a new Version.
- Older Versions remain immutable.
- Only one Official Version exists.
- Versioning never changes ownership.

---

# Immutable Concepts

Concepts/states that become immutable under normal business meaning:

- Verified Match result meaning
- Published Drawing Seed / Published Drawing Official Version history
- Older Versions after a new Version is created
- Official Version history records
- Archived Tournament competition structure (terminal in V1)
- Audit Log and Event Log historical entries (append-only meaning)

Immutability does not forbid exceptional Unlock/correction paths; those paths must preserve history rather than erase it.

---

# Audit Concepts

Conceptual objects/actions that must generate audit history:

- Tournament Lifecycle transitions
- Review decisions (approve/reject)
- Publish actions and Official Version designation
- Lock and Unlock actions
- Drawing generation, Replay, Publish, Lock
- Schedule generation, Regeneration, Publish, Lock, Match Rescheduled
- Referee assignment
- Score submission and corrections
- Match Verify, Cancel, Abandon
- Standing recalculation
- Playoff/Bracket generation, approval, Publish
- Champion declaration
- Team withdrawal/replacement
- Exception resolutions by Tournament Admin
- Engine failure detections that block progression (as auditable detections)

Event Log complements Audit Log for domain occurrence timeline meaning.

---

# Business Invariants

Permanent truths of the conceptual model:

- A Category belongs to exactly one Tournament.
- A Team belongs to exactly one Category.
- A Match belongs to exactly one Category.
- A Court belongs to one Tournament.
- Schedule never owns Court.
- Drawing never owns Team.
- Tournament Engine owns nothing.
- Review never changes ownership.
- Publish never bypasses Review where Review is required.
- Only one Official Version exists for a versioned artifact family.
- Verified Match cannot return to Waiting.
- Published history is never deleted.
- Locked artifacts require Unlock before unrestricted modification.
- Champion exists only after Playoff completion.
- Groups are produced from Drawing.
- Standings for official ranking depend on Verified Matches.
- Match remains inside Category Aggregate consistency.

---

# Conceptual Boundaries

### Business Data

Core owned business meaning: Tournament, Category, Team, Player, Court, Sponsor, Gallery, Champion outcome.

### Operational Data

Runtime competition operations: Match Status progression, Referee assignment, Live scoring actions, Warm Up/Live/Finished/Verified transitions.

### Generated Data

Engine-produced artifacts and calculations: Drawing, Groups, Schedule, Standings calculations, Playoff, Bracket, Recommendations, Validation detections.

### Reference Data

Referenced but not owned by the referrer: Court references from Schedule/Match; Referee assignment references from Match.

### Historical Data

Preserved history: prior Versions, Audit Log, Event Log, Archived Tournament records, immutable Official history.

---

# Read Model Concepts

Read Models are conceptual information projections intended for read-only consumers. They describe what published/live business information means when consumed, not how it is stored or delivered.

### Public Tournament View

Published Tournament-level information for public consumption.

### Public Schedule View

Published Schedule information for participants and audiences.

### Live Scoreboard View

Live and recently updated Match scoring information for operational and public presentation.

### Standings View

Published Standings information for qualification and public ranking display.

### Bracket View

Published Bracket progression information for playoff follow-along.

### TV Display View

Venue-oriented presentation combining published Schedule, live status, Standings, Bracket, and related presentation meaning.

### Public Match View

Published/live Match information for a single Match context.

### Public Team View

Published Team information within a Category for public consumption.

**Read Model Principles**

- Read Models own nothing.
- Read Models are derived from Published business information.
- Read Models never modify business entities.
- Read Models exist only for information consumption.
- Read Models are independent from Aggregate ownership.

---

# Business Identity Concepts

Business Identity describes how a concept remains uniquely meaningful in the business, independent of technical identifiers.

| Concept | Business Identity | Identity Stability | Identity Scope | Identity Evolution |
| --- | --- | --- | --- | --- |
| Tournament | The single competitive event recognized as one Tournament | Stable from creation through Archive | Platform / event scope | Lifecycle state evolves; identity remains the same Tournament |
| Category | The competitive division inside a specific Tournament | Stable for the Tournament lifetime once created | Within one Tournament | Configuration may evolve under rules; identity remains the same Category |
| Team | The competing unit registered in a specific Category | Stable for Category competition once registered | Within one Category | Composition may change under replacement/withdrawal rules; Team identity remains |
| Match | The specific contest between sides in a Category schedule/playoff path | Stable once created through Schedule/Playoff structure | Within one Category | Match Status evolves; Court/Referee references may change under rules; Match identity remains |
| Drawing Version | A distinct generation of Drawing placements for a Category | Stable once created; older versions immutable | Within one Category Drawing history | New Replay creates a new Version; prior Version identity remains historical |
| Schedule Version | A distinct generation of scheduling decisions for a Category | Stable once created; older versions immutable | Within one Category Schedule history | Regeneration creates a new Version; prior Version identity remains historical |
| Playoff | The post-group competition stage of a Category | Stable once generated/officialized for that Category path | Within one Category | Bracket progression evolves; Playoff identity remains |
| Champion | The declared winning outcome of a completed Playoff | Stable once declared | Within one Category / Playoff | Exists only after Playoff completion; no independent pre-existence |

Business Identity never depends on technical key design.

---

# Conceptual Relationship Cardinality

Business cardinality only:

- One Tournament owns many Categories.
- One Tournament owns many Courts.
- One Tournament owns many Sponsors.
- One Tournament owns one Gallery context.
- One Category belongs to exactly one Tournament.
- One Category owns many Teams.
- One Team belongs to exactly one Category.
- One Team contains multiple Players according to Category format.
- One Category owns one Drawing context with many Versions over time.
- One Drawing Version produces many Groups.
- One Category owns many Groups.
- One Group contains many Teams and many group-stage Matches.
- One Category owns many Matches.
- One Match belongs to exactly one Category.
- One Match belongs to either one Group or one Playoff stage.
- One Category owns one Schedule context with many Versions over time.
- One Schedule references many Courts.
- One Court may be referenced by many Matches over time.
- One Match may reference one Court at a time through Schedule.
- One Match may reference one Referee Assignment.
- One Category owns Standings for its Teams.
- Many Verified Matches update Standings.
- One Category owns one Playoff.
- One Playoff owns one Bracket.
- One Playoff owns many playoff-stage Matches.
- One Playoff derives one Champion.
- One Official Version exists per versioned artifact family at a time.
- Many historical Versions may exist for the same artifact family.

---

# Business Events

Major business events of Set Point. These are conceptual business occurrences, not messaging technology.

| Business Event | Trigger | Business Meaning | Primary Consumers |
| --- | --- | --- | --- |
| Tournament Created | Authorized admin creates Tournament | Tournament identity exists in Draft | Tournament Admin, Audit/Event history |
| Tournament Published | Tournament Admin publishes Tournament lifecycle | Tournament becomes officially released | Tournament Admin, Referee, Public Viewer, TV Display |
| Category Created | Tournament Admin creates Category | Competition division exists under Tournament | Tournament Admin |
| Drawing Generated | Tournament Engine generates Drawing | Candidate Drawing Version exists for Review | Tournament Admin, Audit/Event history |
| Drawing Published | Tournament Admin Publishes Drawing after Review | Official Drawing Version established | Groups path, Tournament Admin, Audit/Event history |
| Schedule Generated | Tournament Engine generates Schedule | Candidate Schedule Version exists for Review | Tournament Admin, Validation/Recommendation meaning |
| Schedule Published | Tournament Admin Publishes Schedule after Review | Official Schedule available for operations and presentation | Referee, Public Schedule View, TV Display View |
| Match Started | Authorized actor moves Match to Live | Official live play has begun | Live Scoreboard View, TV Display View, Event Log |
| Match Finished | Authorized actor finishes Live Match | Play ended; result pending verification path | Tournament Admin, Referee, Event Log |
| Match Verified | Authorized actor verifies Match result | Official Match outcome established | Standing update path, Playoff progression, Audit/Event history |
| Standing Updated | Verified Match result applied or recalculation completed | Rankings reflect official results | Standings View, Playoff qualification, Public Viewer, TV Display |
| Playoff Generated | Tournament Engine generates Playoff/Bracket candidates | Playoff/Bracket ready for Review | Tournament Admin |
| Bracket Published | Tournament Admin Publishes Bracket after Review | Official Bracket available for consumers | Bracket View, Public Viewer, TV Display |
| Champion Declared | Playoff completes successfully | Category winner outcome exists | Public Tournament View, Tournament Finished readiness, Audit/Event history |
| Tournament Archived | Tournament Admin archives Finished Tournament | Tournament becomes historical/read-oriented | Audit/Event history, historical read consumers |

---

# Read and Write Responsibilities

### Write Concepts

Authoritative business concepts that may be created, changed, reviewed, published, locked, or progressed under Business Rules:

- Tournament
- Category
- Team
- Drawing
- Group
- Schedule
- Match
- Standing
- Playoff
- Bracket

### Read Concepts

Derived presentation concepts for consumption only:

- Public Tournament View
- TV Display View
- Public Schedule View
- Standings View
- Live Scoreboard View
- Bracket View
- Public Match View
- Public Team View

**Responsibility separation**

- Business entities are authoritative.
- Read concepts are derived.
- Read concepts never own business data.
- Ownership remains with Aggregates regardless of how information is presented.
- Write concepts change business meaning; Read concepts only expose allowed Published/live meaning.

---

# Cross Aggregate References

Cross-aggregate references conceptually allowed:

- Schedule (Category Aggregate) references Court (Tournament Aggregate).
- Match (Category Aggregate) references Court through Schedule (Tournament-owned Court remains Tournament-owned).
- Match (Category Aggregate) references Referee Assignment (operational role reference).
- Playoff (Category Aggregate) references qualified Teams (same Category Aggregate; qualification reference, not re-ownership).
- Public Views reference Published Tournament and related Published Category information.
- TV Display View references Published/live Tournament and Category presentation meaning.

**Reference rules**

- References never imply ownership.
- References never redefine aggregate boundaries.
- References exist only to connect business concepts.
- Referenced concepts remain owned by their original Aggregate.

---

# Conceptual State Machines

The following state progressions describe conceptual business lifecycles only.

Their purpose is to provide a common business understanding before Logical ERD, REST API, Backend Architecture, and implementation.

They are not implementation state machines.

They do not define:

- transition permissions
- validation logic
- authorization
- database constraints
- technical workflows

---

## Tournament Lifecycle

```text
Draft
↓
Setup
↓
Published
↓
Live
↓
Finished
↓
Archived
```

| State | Business Meaning |
| --- | --- |
| Draft | Tournament exists as an initial, non-operational preparation record |
| Setup | Tournament is being configured with categories, resources, and generated artifacts |
| Published | Tournament is officially released for intended operational and viewing audiences |
| Live | Tournament competition operations are actively underway |
| Finished | Competitive play has concluded; closure and archival preparation remain |
| Archived | Tournament is preserved in a read-oriented historical state |

---

## Match Lifecycle

```text
Waiting
↓
Warm Up
↓
Live
↓
Finished
↓
Verified
```

| State | Business Meaning |
| --- | --- |
| Waiting | Match is scheduled or queued and not yet in on-court preparation |
| Warm Up | Participants are in pre-play preparation before official scoring |
| Live | Match is in progress and official scoring is accepted |
| Finished | Play has ended and a result exists pending verification |
| Verified | Match result is confirmed as the official recorded outcome |

Exceptional paths such as Cancelled or Abandoned remain governed by Business Rules and are intentionally omitted from the primary lifecycle.

---

## Drawing Lifecycle

```text
Generated
↓
Reviewed
↓
Published
↓
Locked
```

| State | Business Meaning |
| --- | --- |
| Generated | Tournament Engine has produced a Drawing candidate Version |
| Reviewed | Tournament Admin has examined the candidate for acceptance |
| Published | Drawing is the Official Version for intended consumers |
| Locked | Drawing is protected against unrestricted modification |

Replay creates a new Version instead of modifying an existing Published version.

---

## Schedule Lifecycle

```text
Generated
↓
Reviewed
↓
Published
↓
Locked
```

| State | Business Meaning |
| --- | --- |
| Generated | Tournament Engine has produced a Schedule candidate Version |
| Reviewed | Tournament Admin has examined the candidate for acceptance |
| Published | Schedule is the Official Version for operations and presentation |
| Locked | Schedule is protected against unrestricted regeneration or modification |

Regeneration creates a new Version while preserving historical Versions.

---

## Playoff Lifecycle

```text
Generated
↓
Reviewed
↓
Published
↓
Locked
```

| State | Business Meaning |
| --- | --- |
| Generated | Tournament Engine has produced Playoff/Bracket candidate Versions |
| Reviewed | Tournament Admin has examined the candidate for acceptance |
| Published | Playoff/Bracket is official for intended consumers |
| Locked | Playoff/Bracket structure is protected against unrestricted rebuild |

Progression of playoff Matches occurs independently after publication.

---

## Version Lifecycle

```text
Generated
↓
Candidate Version
↓
Official Version
↓
Historical Version
```

| State | Business Meaning |
| --- | --- |
| Generated | A new Version has been produced by generation, Replay, or Regeneration |
| Candidate Version | Version exists for Review and is not yet Official |
| Official Version | Version is the single published business truth for consumers |
| Historical Version | Prior Version retained immutably after a newer Official Version exists |

Only one Official Version exists.  
Historical Versions remain immutable.

---

## State Machine Principles

- States represent business meaning only.
- State transitions are conceptual.
- Detailed transition rules belong to Business Rules.
- Authorization belongs to Software Requirements.
- Validation belongs to Backend Architecture.
- Technical implementation belongs to application services.

---

# Out of Scope

This Conceptual Data Model does **not** include:

- Database tables
- Columns
- UUID design
- Indexes
- Foreign Keys
- Prisma models
- SQL
- Caching
- Redis
- Event implementation mechanisms
- API contracts
- GraphQL schemas
- Physical storage decisions
- Attribute catalogs / data dictionaries

Those belong to later Logical ERD and Physical Database Design.

---

# Traceability

```text
Business Domain Model
(structure, aggregates, ownership)
↓
Business Rules
(behavior, authority, invariants)
↓
Tournament Engine Specification
(generation capabilities and constraints)
↓
Software Requirements Specification
(system features and acceptance)
↓
Conceptual Data Model
(business information concepts and relationships)
↓
(future) Logical ERD
↓
(future) Physical Database Design
↓
(future) REST API Specification
↓
(future) WebSocket Specification
↓
(future) Backend Architecture
```

Every later data design and interface artifact must derive from this CDM without redefining ownership or business meaning.

The Conceptual Data Model is the conceptual foundation for Logical ERD, Physical Database Design, REST API Specification, WebSocket Specification, and Backend Architecture.

The Conceptual State Machines provide the conceptual foundation for backend state management, API validation rules, workflow orchestration, and quality assurance test scenarios without defining implementation.

---

# Document Summary

| Metric | Count |
| --- | --- |
| Total Conceptual Entities | 22 |
| Total Relationships | 35 |
| Total Aggregate Roots | 2 |
| Total Reference Relationships | 3 |
| Total Generated Concepts | 6 |
| Total Business Events | 15 |
| Total Read Models | 8 |
| Total Write Concepts | 10 |

Notes:

- Aggregate Roots remain Tournament and Category.
- Generated Concepts remain Drawing, Groups, Schedule, Standings, Playoff, Bracket.
- Reference Relationships remain Schedule→Court, Match→Court, Match→Referee Assignment.
- Read Models own nothing and are derived from Published business information.

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Lead Domain Architect | Initial Conceptual Data Model for Foundation Sprint |
| 0.1.1 | 2026-07-25 | Lead Domain Architect | Added Read Models, Business Identity, Cardinality, Business Events, Read/Write Responsibilities, Cross Aggregate References |
| 0.1.2 | 2026-07-25 | Lead Domain Architect | Added Conceptual State Machines |

---

*This Conceptual Data Model is the governing pre-ERD information model for Set Point. Logical ERD, physical database design, persistence schemas, REST API, WebSocket, and backend architecture must remain consistent with the concepts, relationships, and invariants defined herein.*
