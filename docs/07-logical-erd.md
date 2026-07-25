# Logical Entity Relationship Model

| Field | Value |
| --- | --- |
| Document | Logical Entity Relationship Model (Logical ERD) |
| Product | Set Point |
| Version | 0.1.1 |
| Status | Logical Design Phase |
| Classification | Internal — Logical Data Architecture |
| Last Updated | 2026-07-25 |
| Depends On | `00-project-charter.md`, `01-product-glossary.md`, `02-domain-model.md`, `03-business-rules.md`, `04-tournament-engine-specification.md`, `05-software-requirements-specification.md`, `06-conceptual-data-model.md` |

---

## 1. Purpose

This document translates approved conceptual business information into a **logical data structure**.

It defines how Set Point business meaning is represented as logical entities, attributes, relationships, cardinality, and optionality—so that Physical Database Design, REST API design, and backend modules can be derived without redefining business truth.

The Conceptual Data Model remains the single source of truth for business information meaning. This Logical ERD elaborates that meaning into a structured logical model. It does not redesign the business.

Conflict resolution order:

```text
Conceptual Data Model
↓
Business Rules
↓
Domain Model
↓
SRS
```

---

## 2. Scope

This Logical ERD defines:

- Logical entities
- Logical attributes
- Relationships
- Cardinality
- Optionality
- Business identifiers
- Associative entities
- Derived attributes
- Reference concepts
- Logical constraints

It does **not** define physical database design, ORM mapping, SQL, indexes, or runtime storage.

---

## 3. Modeling Principles

1. **Business First** — Logical structure follows business meaning.
2. **Normalization** — Approximate Third Normal Form; no duplicated business meaning.
3. **Single Source of Truth** — One authoritative owner for each business fact.
4. **Technology Independent** — No engine, ORM, or SQL concepts.
5. **Version Aware** — Generated artifacts support Version lifecycle.
6. **Audit Friendly** — Significant actions are accountable.
7. **Readability** — Names follow Product Glossary terminology.
8. **Consistency** — Aligns with Domain Model ownership and Conceptual State Machines.
9. **No Physical Database Concepts** — No tables, keys-as-storage, indexes, or types.
10. **Aggregate Respect** — Tournament and Category ownership boundaries remain intact.

---

# Entity Classification

Every logical entity belongs to exactly one classification. Classification improves readability and Physical Database Design derivation. It does **not** change Aggregate ownership or business meaning.

### Core Business Entities

Authoritative business entities that represent the primary competition and event structure.

- Tournament
- Category
- Court
- Team
- Player
- Group
- Match
- Standing
- Playoff
- Bracket
- Champion
- Sponsor
- Gallery
- Gallery Item

**Responsibility:** Hold core business facts and ownership relationships.

### Generated Entities

Entities produced or versioned through Tournament Engine generation under Category ownership.

- Drawing
- Drawing Version
- Schedule
- Schedule Version

**Responsibility:** Represent generated artifacts and their immutable version history. Engine generates them; Aggregates own them.

### Associative Entities

Logical association entities that resolve multi-sided relationships without changing ownership.

- Group Membership
- Match Participation
- Schedule Entry
- Referee Assignment

**Responsibility:** Connect business entities while preserving Aggregate boundaries and reference semantics.

### Supporting Entities

Governance, accountability, and control-support entities.

- Review
- Audit Log
- Event Log

**Responsibility:** Support Review decisions and append-oriented Audit/Event history.

### Conceptual State Concepts

Cross-cutting state/value concepts referenced by entities. They are not independent owned Aggregates.

- Publish State
- Lock State
- Version

**Responsibility:** Express publish, lock, and version meaning consistently across artifacts. Detailed definitions appear in Conceptual State Concepts.

---

# Common Attribute Profiles

The following profiles are reusable conceptual attribute groups. They improve consistency and maintainability. They are not physical schemas.

Entities that use a profile list unique attributes separately and declare inheritance of the profile.

### Common Audit Attributes

- Created By
- Created At
- Last Modified By
- Last Modified At

### Common Publish Attributes

- Publish State
- Published By
- Published At

### Common Lock Attributes

- Lock State
- Locked By
- Locked At
- Unlock Reason

### Common Version Attributes

- Version Number
- Version Status
- Official Flag
- Generation Source

---

# Attribute Ownership Principles

Logical attributes fall into these conceptual categories:

### Authoritative Attributes

Master business facts owned by the entity (for example Tournament Name, Match Status, Team Name).

### Derived Attributes

Calculated or concluded from authoritative facts (for example Match Winner, Group Rank, Qualification Status). Identified in Derived Attributes; not independent masters of truth.

### Reference Attributes

Business identifiers that point to another entity without transferring ownership (for example Court Identifier on Schedule Entry, Tournament Identifier on Category).

### Audit Attributes

Accountability and modification-tracking attributes, typically via Common Audit Attributes and Audit Information.

### Version Attributes

Version lifecycle attributes, typically via Common Version Attributes on versioned entities.

---

# Entity Dependency Hierarchy

Logical dependency illustrates generation and structural dependence. Dependency does **not** change Aggregate ownership.

```text
Tournament
↓
Category
↓
Drawing
↓
Drawing Version
↓
Group
↓
Match
```

```text
Category
↓
Schedule
↓
Schedule Version
↓
Schedule Entry
↓
Match
```

```text
Category
↓
Standing
↓
Playoff
↓
Bracket
↓
Champion
```

Supporting overlays:

```text
Generate → Review → Publish State (Official Version) → Lock State
```

```text
Match → Verified → Standing update
```

Tournament remains Aggregate Root for Courts, Sponsors, Gallery, and Audit/Event context. Category remains Aggregate Root for competition structure including Matches.

---

# Entity Catalog

For each entity: Purpose, Business Responsibility, Lifecycle, Business Identifier, Attributes, Relationships.

Attribute lists use Common Attribute Profiles where applicable. Unique attributes remain listed explicitly.

---

## Tournament

**Purpose**

Highest-level logical entity for a single competitive padel event.

**Business Responsibility**

Own Categories, Courts, Sponsors, Gallery, and tournament-wide Audit/Event context.

**Lifecycle**

Draft → Setup → Published → Live → Finished → Archived.

**Business Identifier**

Tournament Identifier.

**Attributes**

Inherits Common Audit Attributes.  
Inherits Common Publish Attributes.

- Tournament Identifier
- Tournament Name
- Description
- Tournament Status
- Registration Open Date
- Registration Close Date
- Start Date
- End Date
- Visibility
- Audit Information

**Relationships**

Owns Category, Court, Sponsor, Gallery; provides context for Audit Log and Event Log.

---

## Category

**Purpose**

Competitive division within a Tournament.

**Business Responsibility**

Own Teams, Drawing, Groups, Matches, Schedule, Standings, and Playoff consistency.

**Lifecycle**

Created in preparation; progresses through competition generation and play under Tournament Lifecycle.

**Business Identifier**

Category Identifier (unique within Tournament).

**Attributes**

Inherits Common Audit Attributes.  
Inherits Common Publish Attributes.  
Inherits Common Lock Attributes.

- Category Identifier
- Tournament Identifier (ownership reference)
- Category Name
- Category Format
- Category Configuration
- Visibility
- Audit Information

**Relationships**

Belongs to Tournament; owns Team, Drawing, Group, Schedule, Match, Standing, Playoff.

---

## Court

**Purpose**

Playable venue resource of a Tournament.

**Business Responsibility**

Provide location meaning referenced by Schedule and Match.

**Lifecycle**

Configured in Setup; referenced in Published/Live; retained historically.

**Business Identifier**

Court Identifier (unique within Tournament).

**Attributes**

Inherits Common Audit Attributes.

- Court Identifier
- Tournament Identifier (ownership reference)
- Court Name
- Court Label
- Court Status
- Availability Notes

**Relationships**

Owned by Tournament; referenced by Schedule Version / Match scheduling decisions.

---

## Team

**Purpose**

Primary competing unit registered in a Category.

**Business Responsibility**

Represent the competing side for Drawing, Matches, Standings, and Playoff.

**Lifecycle**

Registration → eligibility → participation → possible withdrawal.

**Business Identifier**

Team Identifier (unique within Category).

**Attributes**

Inherits Common Audit Attributes.

- Team Identifier
- Category Identifier (ownership reference)
- Team Name
- Team Status
- Eligibility Status
- Withdrawal Flag
- Withdrawal Reason
- Audit Information

**Relationships**

Owned by Category; contains Players; participates in Group Membership, Match Participation, Standing; may qualify for Playoff.

---

## Player

**Purpose**

Individual participant assigned to a Team.

**Business Responsibility**

Identify people in Team composition and Match participation context.

**Lifecycle**

Assigned / replaced under Team rules; retained in composition history.

**Business Identifier**

Player Identifier (unique within Category composition context).

**Attributes**

Inherits Common Audit Attributes.

- Player Identifier
- Team Identifier (composition ownership reference)
- Player Display Name
- Player Status
- Replacement Flag

**Relationships**

Belongs to Team; may appear in Match Participation.

---

## Drawing

**Purpose**

Category-owned Drawing context for group placement artifacts.

**Business Responsibility**

Anchor Drawing Versions, Review, Publish State, and Lock State for group placement.

**Lifecycle**

Exists with Category; progresses through Generated → Reviewed → Published → Locked via Versions.

**Business Identifier**

Drawing Identifier (unique within Category).

**Attributes**

Inherits Common Audit Attributes.  
Inherits Common Publish Attributes.  
Inherits Common Lock Attributes.

- Drawing Identifier
- Category Identifier (ownership reference)
- Current Official Version Identifier
- Review Status
- Audit Information

**Relationships**

Owned by Category; has many Drawing Versions; produces Groups from Official Version.

---

## Drawing Version

**Purpose**

A distinct generation of Drawing placements, including Drawing Seed meaning.

**Business Responsibility**

Preserve reproducible placement history; support Replay as new Version.

**Lifecycle**

Generated → Candidate Version → Official Version → Historical Version.

**Business Identifier**

Drawing Version Identifier (unique within Drawing).

**Attributes**

Inherits Common Version Attributes.

- Drawing Version Identifier
- Drawing Identifier (ownership reference)
- Drawing Seed
- Review Outcome
- Created By
- Created At
- Audit Information

**Relationships**

Belongs to Drawing; reviewed via Review; may become Official Version; historical Versions remain immutable.

---

## Group

**Purpose**

Preliminary pool subdivision of Teams within a Category.

**Business Responsibility**

Structure group-stage competition and contain group-stage Matches.

**Lifecycle**

Produced from Drawing; used through group play; protected after Lock/Verified history.

**Business Identifier**

Group Identifier (unique within Category / Drawing context).

**Attributes**

Inherits Common Audit Attributes.  
Inherits Common Publish Attributes.  
Inherits Common Lock Attributes.

- Group Identifier
- Category Identifier (ownership reference)
- Drawing Version Identifier (generation reference)
- Group Name
- Group Label

**Relationships**

Owned by Category; derived from Drawing Version; contains Teams via Group Membership; contains group-stage Matches.

---

## Schedule

**Purpose**

Category-owned Schedule context for Match timing and Court assignment decisions.

**Business Responsibility**

Own scheduling decisions; reference Courts; never own Courts.

**Lifecycle**

Generated → Reviewed → Published → Locked via Schedule Versions.

**Business Identifier**

Schedule Identifier (unique within Category).

**Attributes**

Inherits Common Audit Attributes.  
Inherits Common Publish Attributes.  
Inherits Common Lock Attributes.

- Schedule Identifier
- Category Identifier (ownership reference)
- Current Official Version Identifier
- Review Status
- Audit Information

**Relationships**

Owned by Category; has many Schedule Versions; plans Matches.

---

## Schedule Version

**Purpose**

A distinct generation of scheduling decisions.

**Business Responsibility**

Preserve Schedule history; support Regeneration as new Version.

**Lifecycle**

Generated → Candidate Version → Official Version → Historical Version.

**Business Identifier**

Schedule Version Identifier (unique within Schedule).

**Attributes**

Inherits Common Version Attributes.

- Schedule Version Identifier
- Schedule Identifier (ownership reference)
- Review Outcome
- Conflict Status
- Created By
- Created At
- Audit Information

**Relationships**

Belongs to Schedule; contains scheduling entries that assign Match timing and Court references.

---

## Match

**Purpose**

Atomic competitive contest within a Category.

**Business Responsibility**

Carry Match Status progression and official result meaning after Verification.

**Lifecycle**

Waiting → Warm Up → Live → Finished → Verified (Cancelled/Abandoned via Business Rules).

**Business Identifier**

Match Identifier (unique within Category).

**Attributes**

Inherits Common Audit Attributes.

- Match Identifier
- Category Identifier (ownership reference)
- Group Identifier (optional structural reference)
- Playoff Identifier (optional structural reference)
- Bracket Position Reference
- Schedule Version Identifier (scheduling reference)
- Court Identifier (reference)
- Match Status
- Scheduled Start Time
- Actual Start Time
- Actual End Time
- Score Representation
- Result Status
- Cancellation Flag
- Abandonment Flag
- Exception Reason
- Publish Visibility
- Audit Information

**Relationships**

Owned by Category; belongs to Group or Playoff stage; references Court; references Referee Assignment; has Match Participation; updates Standing when Verified.

---

## Standing

**Purpose**

Ranked competitive position of a Team within Category/Group context.

**Business Responsibility**

Reflect Verified results and support Playoff qualification.

**Lifecycle**

Updated on Verify; may be recalculated; may be Published/Locked.

**Business Identifier**

Standing Identifier (unique for Team within Standing context).

**Attributes**

Inherits Common Publish Attributes.  
Inherits Common Lock Attributes.

- Standing Identifier
- Category Identifier (ownership reference)
- Group Identifier (optional context)
- Team Identifier (subject reference)
- Rank Position
- Matches Played
- Wins
- Losses
- Points
- Tie Break Notes
- Qualification Status
- Last Recalculated At
- Audit Information

**Relationships**

Owned by Category; references Team; depends on Verified Matches; feeds Playoff qualification.

---

## Playoff

**Purpose**

Post-group competition stage of a Category.

**Business Responsibility**

Own Bracket, playoff-stage Matches, and Champion outcome.

**Lifecycle**

Generated → Reviewed → Published → Locked; Match progression continues after Publish.

**Business Identifier**

Playoff Identifier (unique within Category).

**Attributes**

Inherits Common Audit Attributes.  
Inherits Common Publish Attributes.  
Inherits Common Lock Attributes.

- Playoff Identifier
- Category Identifier (ownership reference)
- Current Official Version Identifier
- Review Status
- Qualification Basis
- Audit Information

**Relationships**

Owned by Category; owns Bracket; owns playoff-stage Matches; derives Champion; references qualified Teams.

---

## Bracket

**Purpose**

Structured map of Playoff Match progression.

**Business Responsibility**

Represent advancement path to Champion.

**Lifecycle**

Generated with Playoff → Reviewed → Published → advances from Verified playoff Matches.

**Business Identifier**

Bracket Identifier (unique within Playoff).

**Attributes**

Inherits Common Audit Attributes.  
Inherits Common Publish Attributes.  
Inherits Common Lock Attributes.  
Inherits Common Version Attributes.

- Bracket Identifier
- Playoff Identifier (ownership reference)
- Structure Representation
- Audit Information

**Relationships**

Owned by Playoff; associated with playoff Matches; leads to Champion.

---

## Sponsor

**Purpose**

Tournament-level commercial/presentation association.

**Business Responsibility**

Belong to Tournament presentation context.

**Lifecycle**

Configured with Tournament; retained historically.

**Business Identifier**

Sponsor Identifier (unique within Tournament).

**Attributes**

Inherits Common Audit Attributes.

- Sponsor Identifier
- Tournament Identifier (ownership reference)
- Sponsor Name
- Sponsor Display Order
- Visibility

**Relationships**

Owned by Tournament; presented via public/TV read meaning.

---

## Gallery

**Purpose**

Tournament-owned media collection context.

**Business Responsibility**

Hold event media for presentation and historical retention.

**Lifecycle**

Managed during Tournament life; retained when Archived.

**Business Identifier**

Gallery Identifier (unique within Tournament).

**Attributes**

Inherits Common Audit Attributes.

- Gallery Identifier
- Tournament Identifier (ownership reference)
- Gallery Title
- Visibility

**Relationships**

Owned by Tournament; contains Gallery Item (logical media entries).

---

## Gallery Item

**Purpose**

Individual media entry within Gallery.

**Business Responsibility**

Represent one gallery media resource meaning.

**Lifecycle**

Added/updated/removed under Gallery management rules.

**Business Identifier**

Gallery Item Identifier (unique within Gallery).

**Attributes**

Inherits Common Audit Attributes.

- Gallery Item Identifier
- Gallery Identifier (ownership reference)
- Media Title
- Media Reference
- Display Order
- Visibility

**Relationships**

Owned by Gallery.

---

## Audit Log

**Purpose**

Authoritative accountability record of significant business actions.

**Business Responsibility**

Capture who changed what and when at business-meaningful level.

**Lifecycle**

Append-oriented through Tournament life and Archive retention.

**Business Identifier**

Audit Entry Identifier.

**Attributes**

- Audit Entry Identifier
- Tournament Identifier (context reference)
- Actor Identity
- Action Type
- Affected Entity Type
- Affected Entity Identifier
- Previous Official State
- New Official State
- Reason
- Related Version Identifier
- Occurred At

**Relationships**

Contextualized by Tournament; references affected business entities by business identity.

---

## Event Log

**Purpose**

Chronological record of meaningful domain occurrences.

**Business Responsibility**

Provide operational timeline of what happened.

**Lifecycle**

Append-oriented through Tournament life and Archive retention.

**Business Identifier**

Event Entry Identifier.

**Attributes**

- Event Entry Identifier
- Tournament Identifier (context reference)
- Event Type
- Related Entity Type
- Related Entity Identifier
- Event Meaning
- Occurred At

**Relationships**

Contextualized by Tournament; complements Audit Log.

---

## Referee Assignment

**Purpose**

Operational assignment linking a Referee role to a Match.

**Business Responsibility**

Authorize Match scoring/operation scope for that Referee.

**Lifecycle**

Assignable from Published onward; auditable; reassignment allowed under rules.

**Business Identifier**

Referee Assignment Identifier.

**Attributes**

- Referee Assignment Identifier
- Match Identifier (subject reference)
- Referee Identity
- Assignment Status
- Assigned By
- Assigned At
- Unassigned At
- Audit Information

**Relationships**

References Match; does not transfer Match ownership.

---

## Champion

**Purpose**

Official competitive outcome of a completed Playoff.

**Business Responsibility**

Record Category winner meaning after Playoff completion.

**Lifecycle**

Exists only after successful Playoff completion; no independent pre-lifecycle.

**Business Identifier**

Champion Identifier (unique within Playoff/Category).

**Attributes**

- Champion Identifier
- Playoff Identifier (derivation reference)
- Category Identifier (context reference)
- Winning Team Identifier
- Declared At
- Declared By
- Declaration Status
- Audit Information

**Relationships**

Derived from Playoff; references Winning Team; supports Tournament Finished readiness.

---

## Review

**Purpose**

Formal examination record of a required Engine-generated artifact Version.

**Business Responsibility**

Gate approval before Publish; does not make artifacts official; does not change ownership.

**Lifecycle**

Pending → Approved or Rejected.

**Business Identifier**

Review Identifier.

**Attributes**

- Review Identifier
- Artifact Type
- Artifact Identifier
- Version Identifier
- Review Status
- Reviewer Identity
- Review Decision
- Review Notes
- Reviewed At
- Audit Information

**Relationships**

References Drawing Version, Schedule Version, Playoff/Bracket Version as applicable.

---

## Group Membership

**Purpose**

Associative logical entity resolving Team placement into a Group.

**Business Responsibility**

Record that a Team belongs to a Group from a Drawing Version.

**Lifecycle**

Created from Drawing; protected after Lock/Verified history.

**Business Identifier**

Group Membership Identifier.

**Attributes**

- Group Membership Identifier
- Group Identifier
- Team Identifier
- Drawing Version Identifier
- Placement Order
- Created At

**Relationships**

Associates Group and Team.

---

## Match Participation

**Purpose**

Associative logical entity resolving which Teams (and optionally Players) participate in a Match.

**Business Responsibility**

Record competing sides for a Match.

**Lifecycle**

Created with Match scheduling/structure; retained historically.

**Business Identifier**

Match Participation Identifier.

**Attributes**

- Match Participation Identifier
- Match Identifier
- Team Identifier
- Side Label
- Player Composition Snapshot
- Created At

**Relationships**

Associates Match and Team.

---

## Schedule Entry

**Purpose**

Associative/detail logical entity resolving Match timing and Court reference within a Schedule Version.

**Business Responsibility**

Carry one scheduling decision for one Match.

**Lifecycle**

Created with Schedule Version; may change via Reschedule under rules.

**Business Identifier**

Schedule Entry Identifier.

**Attributes**

- Schedule Entry Identifier
- Schedule Version Identifier
- Match Identifier
- Court Identifier (reference)
- Scheduled Start Time
- Scheduled End Time
- Sequence Order
- Reschedule Flag
- Created At
- Last Modified At

**Relationships**

Belongs to Schedule Version; references Match and Court.

---

## Entity Summary Table

| Entity | Classification | Versioned | Auditable | Derived | Lifecycle |
| --- | --- | --- | --- | --- | --- |
| Tournament | Core Business Entity | No | Yes | No | Draft → Setup → Published → Live → Finished → Archived |
| Category | Core Business Entity | No | Yes | No | Created → configured → competition → retained |
| Court | Core Business Entity | No | Yes | No | Configured → referenced → retained |
| Team | Core Business Entity | No | Yes | Partial (Eligibility) | Registered → active/withdrawn → retained |
| Player | Core Business Entity | No | Yes | No | Assigned → replaced(optional) → retained |
| Group | Core Business Entity | No | Yes | No | Produced → used → protected |
| Match | Core Business Entity | No | Yes | Partial (Winner) | Waiting → Warm Up → Live → Finished → Verified |
| Standing | Core Business Entity | No | Yes | Yes | Updated on Verify; recalculated as needed |
| Playoff | Core Business Entity | Yes | Yes | No | Generated → Reviewed → Published → Locked |
| Bracket | Core Business Entity | Yes | Yes | No | Generated → Published → advances on Verified Matches |
| Champion | Core Business Entity | No | Yes | Yes | Exists only after Playoff completion |
| Sponsor | Core Business Entity | No | Yes | No | Configured → retained |
| Gallery | Core Business Entity | No | Yes | No | Managed → retained |
| Gallery Item | Core Business Entity | No | Yes | No | Added/updated/removed |
| Drawing | Generated Entity | Yes | Yes | No | Context; Versions Generated → Reviewed → Published → Locked |
| Drawing Version | Generated Entity | Yes | Yes | No | Generated → Candidate → Official/Historical |
| Schedule | Generated Entity | Yes | Yes | No | Context; Versions Generated → Reviewed → Published → Locked |
| Schedule Version | Generated Entity | Yes | Yes | Partial (Conflict Status) | Generated → Candidate → Official/Historical |
| Group Membership | Associative Entity | No | Yes | No | Created from Drawing → protected |
| Match Participation | Associative Entity | No | Yes | No | Created with Match → retained |
| Schedule Entry | Associative Entity | No | Yes | No | Created with Schedule Version; reschedule under rules |
| Referee Assignment | Associative Entity | No | Yes | No | Assigned → active → unassigned/reassigned |
| Review | Supporting Entity | Associated | Yes | No | Pending → Approved/Rejected |
| Audit Log | Supporting Entity | No | Yes (is audit) | No | Append-only |
| Event Log | Supporting Entity | No | Yes (timeline) | No | Append-only |
| Publish State | Conceptual State Concept | N/A | Via host entity | No | Unpublished → Published/Official |
| Lock State | Conceptual State Concept | N/A | Via host entity | No | Unlocked → Locked (Unlock exceptional) |
| Version | Conceptual State Concept | Yes | Via host entity | No | Generated → Candidate → Official → Historical |

---

# Conceptual State Concepts

Publish State, Lock State, and Version are conceptual state/value concepts referenced by entities. They are not independent owned Aggregates. Business meaning is unchanged from the Conceptual Data Model.

### Publish State

**Purpose**

Logical representation of whether a business artifact or Tournament is official for intended consumers.

**Business Responsibility**

Express Official vs unpublished meaning.

**Lifecycle**

Unpublished/internal → Published/Official.

**Business Identifier**

Expressed as state meaning on owning entities.

**Attributes**

Aligned with Common Publish Attributes:

- Publish State Value
- Published At
- Published By
- Official Version Identifier

**Referenced By**

Tournament, Drawing, Schedule, Standing, Playoff, Bracket, Group, and related publishable artifacts.

---

### Lock State

**Purpose**

Logical representation of integrity protection against unrestricted modification.

**Business Responsibility**

Express Locked vs unlocked meaning; Unlock remains exceptional.

**Lifecycle**

Unlocked/editable (within rules) → Locked; exceptional Unlock → re-Lock.

**Business Identifier**

Expressed as state meaning on owning entities.

**Attributes**

Aligned with Common Lock Attributes, plus unlock tracking:

- Lock State Value
- Locked At
- Locked By
- Unlock Reason
- Unlocked At
- Unlocked By

**Referenced By**

Drawing, Schedule, Groups/Playoff structure, Standing, Category integrity-sensitive artifacts, and related locked artifacts.

---

### Version

**Purpose**

Generic logical meaning of a distinct generation of a version-aware artifact.

**Business Responsibility**

Distinguish Candidate, Official, and Historical Versions.

**Lifecycle**

Generated → Candidate Version → Official Version → Historical Version.

**Business Identifier**

Version Identifier within its artifact family.

**Attributes**

Aligned with Common Version Attributes:

- Version Identifier
- Artifact Type
- Artifact Identifier
- Version Number
- Version Status
- Official Flag
- Generation Source
- Created By
- Created At

**Specialized As**

Drawing Version, Schedule Version, and Playoff/Bracket version meaning.

**Rules**

- Only one Official Version exists per artifact family.
- Historical Versions remain immutable.
- Versioning never changes Aggregate ownership.

---

# Business Identifiers

Business identifiers uniquely recognize entities in business terms. This section does not define technical keys.

| Entity | Primary Business Identifier | Candidate Identifiers | Business Uniqueness |
| --- | --- | --- | --- |
| Tournament | Tournament Identifier | Tournament Name within operator scope | One identity per event |
| Category | Category Identifier | Category Name within Tournament | Unique within Tournament |
| Court | Court Identifier | Court Name/Label within Tournament | Unique within Tournament |
| Team | Team Identifier | Team Name within Category | Unique within Category |
| Player | Player Identifier | Player Display Name within Team/Category | Unique within Category composition rules |
| Drawing | Drawing Identifier | — | One Drawing context per Category |
| Drawing Version | Drawing Version Identifier | Version Number within Drawing | Unique Version Number per Drawing |
| Group | Group Identifier | Group Name within Category/Drawing Version | Unique within Drawing Version |
| Schedule | Schedule Identifier | — | One Schedule context per Category |
| Schedule Version | Schedule Version Identifier | Version Number within Schedule | Unique Version Number per Schedule |
| Match | Match Identifier | Bracket Position / Schedule sequence | Unique within Category |
| Standing | Standing Identifier | Team within Standing context | One Standing row meaning per Team context |
| Playoff | Playoff Identifier | — | One Playoff per Category |
| Bracket | Bracket Identifier | Version Number within Playoff | Unique within Playoff versioning |
| Champion | Champion Identifier | Winning Team within Playoff | One Champion per completed Playoff |
| Review | Review Identifier | Artifact Version under review | Unique review decision record |
| Audit Log | Audit Entry Identifier | — | Unique append entry |
| Event Log | Event Entry Identifier | — | Unique append entry |
| Referee Assignment | Referee Assignment Identifier | Match + Referee during active assignment | Unique active assignment per Match under rules |
| Group Membership | Group Membership Identifier | Group + Team | Unique Team per Group under normal rules |
| Match Participation | Match Participation Identifier | Match + Team/Side | Unique side participation per Match |
| Schedule Entry | Schedule Entry Identifier | Schedule Version + Match | Unique Match entry per Schedule Version |

---

# Relationship Matrix

| From | Relationship | To |
| --- | --- | --- |
| Tournament | owns | Category |
| Tournament | owns | Court |
| Tournament | owns | Sponsor |
| Tournament | owns | Gallery |
| Tournament | contextualizes | Audit Log |
| Tournament | contextualizes | Event Log |
| Gallery | contains | Gallery Item |
| Category | belongs to | Tournament |
| Category | owns | Team |
| Category | owns | Drawing |
| Category | owns | Group |
| Category | owns | Schedule |
| Category | owns | Match |
| Category | owns | Standing |
| Category | owns | Playoff |
| Team | contains | Player |
| Team | participates via | Group Membership |
| Team | participates via | Match Participation |
| Drawing | has | Drawing Version |
| Drawing Version | produces | Group |
| Group | contains via | Group Membership |
| Group | contains | Match (group stage) |
| Schedule | has | Schedule Version |
| Schedule Version | contains | Schedule Entry |
| Schedule Entry | references | Court |
| Schedule Entry | schedules | Match |
| Match | references | Court |
| Match | references | Referee Assignment |
| Match | has | Match Participation |
| Match (Verified) | updates | Standing |
| Standing | references | Team |
| Standing | qualifies | Team for Playoff |
| Playoff | owns | Bracket |
| Playoff | owns | Match (playoff stage) |
| Playoff | derives | Champion |
| Bracket | maps | Match (playoff stage) |
| Champion | references | Team |
| Review | examines | Drawing Version / Schedule Version / Playoff-Bracket Version |
| Publish State | designates | Official Version |
| Lock State | protects | Artifact integrity |

---

# Cardinality Matrix

| Parent | Cardinality | Child |
| --- | --- | --- |
| Tournament | 1 → N | Category |
| Tournament | 1 → N | Court |
| Tournament | 1 → N | Sponsor |
| Tournament | 1 → 1 | Gallery context |
| Gallery | 1 → N | Gallery Item |
| Category | N → 1 | Tournament |
| Category | 1 → N | Team |
| Team | 1 → N | Player |
| Category | 1 → 1 | Drawing context |
| Drawing | 1 → N | Drawing Version |
| Drawing Version | 1 → N | Group |
| Group | 1 → N | Group Membership |
| Group | 1 → N | Match (group stage) |
| Category | 1 → 1 | Schedule context |
| Schedule | 1 → N | Schedule Version |
| Schedule Version | 1 → N | Schedule Entry |
| Category | 1 → N | Match |
| Match | N → 1 | Category |
| Match | 0..1 → 1 | Group or Playoff stage |
| Match | 0..1 → 1 | Court (via reference) |
| Match | 0..1 → 1 | Active Referee Assignment |
| Match | 1 → N | Match Participation |
| Category | 1 → N | Standing |
| Category | 1 → 0..1 | Playoff |
| Playoff | 1 → 1 | Bracket (per Official structure) |
| Playoff | 1 → N | Match (playoff stage) |
| Playoff | 1 → 0..1 | Champion |
| Versioned artifact family | 1 → 1 | Official Version (at a time) |
| Versioned artifact family | 1 → N | Historical Versions |

---

# Optionality

### Mandatory

- Category must belong to a Tournament.
- Team must belong to a Category.
- Match must belong to a Category.
- Court must belong to a Tournament.
- Drawing Version must belong to a Drawing.
- Schedule Version must belong to a Schedule.
- Group Membership must reference Group and Team.
- Match Participation must reference Match and Team.
- Official Version designation requires Publish.

### Optional

- Match Court reference may be absent before scheduling completes.
- Referee Assignment may be absent until assigned.
- Group reference is absent for pure playoff Matches.
- Playoff reference is absent for pure group-stage Matches.
- Champion is absent until Playoff completion.
- Gallery Items may be zero.

### Conditional

- Drawing Publish is conditional on Review approval.
- Schedule Publish is conditional on Review and conflict-free status.
- Playoff generation is conditional on qualification Standings.
- Standing update is conditional on Match Verified.
- Lock Unlock is conditional on exceptional Admin authorization and reason.
- Tournament Finished is conditional on required Champion/closure rules.

---

# Associative Entities

Many-to-many or multi-sided business associations are resolved logically as associative entities:

| Associative Entity | Resolves | Logical Meaning |
| --- | --- | --- |
| Group Membership | Group ↔ Team | Team placement in a Group from Drawing |
| Match Participation | Match ↔ Team | Competing sides in a Match |
| Schedule Entry | Schedule Version ↔ Match (+ Court reference) | Timing and Court assignment decision |
| Referee Assignment | Match ↔ Referee Identity | Operational scoring authority assignment |
| Team Registration | Category ↔ Team | Represented by Team ownership under Category (registration meaning) |

These are logical association meanings only—not physical join-table designs.

---

# Derived Attributes

Derived attributes are calculated or concluded from authoritative facts. They are not independent masters of truth.

| Derived Attribute | Derived From | Notes |
| --- | --- | --- |
| Match Winner | Verified Match result / participation | Exists after verification rules satisfied |
| Group Rank | Standing within Group | From Verified group-stage results |
| Qualification Status | Standing + Category rules | Required before Playoff generation |
| Champion | Completed Playoff / Bracket outcomes | Business outcome, not independent Aggregate |
| Win Ratio | Standing wins/losses or match counts | Presentation/analysis meaning |
| Match Count | Standing or Match Participation history | Derived tally |
| Official Version Flag | Publish State + Version Status | Only one Official Version |
| Conflict Status | Schedule validation detections | Derived from Court/Team conflict checks |
| Eligibility Status | Team composition + Category format | Derived readiness for Drawing |

---

# Reference Data

Business reference concepts (not technical enums):

| Reference Concept | Used By | Business Meaning |
| --- | --- | --- |
| Tournament Status | Tournament | Draft, Setup, Published, Live, Finished, Archived |
| Match Status | Match | Waiting, Warm Up, Live, Finished, Verified |
| Publish State | Publishable artifacts | Unpublished vs Published/Official |
| Lock State | Integrity-sensitive artifacts | Unlocked vs Locked |
| Visibility | Tournament, Category, Gallery, Sponsor | Who may consume information |
| Court Status | Court | Availability/operational readiness meaning |
| Team Status | Team | Active, withdrawn, etc. |
| Version Status | Versions | Candidate, Official, Historical |
| Review Status | Review | Pending, Approved, Rejected |
| Qualification Status | Standing | Qualified / not qualified meaning |
| Result Status | Match | Normal, cancelled, abandoned, corrected (business meaning) |
| Assignment Status | Referee Assignment | Active / inactive |

---

# Normalization

This logical model follows approximately **Third Normal Form**:

- Each non-identifying attribute depends on the business identifier of its entity.
- Business meaning is not duplicated across owners.
- Ownership provides a single source of truth for each fact.
- Cross-aggregate facts use references, not copied ownership.
- Derived values are explicitly identified and not treated as master data.
- Version history stores immutable prior Versions rather than overwriting Official meaning.

---

# Audit Requirements

Auditable entities/actions must capture at minimum:

| Audit Dimension | Meaning |
| --- | --- |
| Who | Actor identity performing the action |
| When | Business time of the action |
| Action | What business action occurred |
| Reason | Required for exceptions (Unlock, correction, withdrawal, abandonment) |
| Version | Related Version identity when action affects versioned artifacts |

**Especially auditable**

Tournament lifecycle, Review, Publish, Lock/Unlock, Drawing Replay, Schedule Regeneration/Reschedule, Referee Assignment, score submission/correction, Match Verify/Cancel/Abandon, Standing recalculation, Playoff/Bracket Publish, Champion declaration, Team withdrawal/replacement, exception resolutions.

Audit Log stores accountability entries. Event Log stores domain occurrence timeline. Both are append-oriented in business meaning.

---

# Versioned Entities

| Versioned Concept | Version Mechanism | Lifecycle |
| --- | --- | --- |
| Drawing | Drawing Version + Drawing Seed | Generated → Candidate → Official → Historical; Replay creates new Version |
| Schedule | Schedule Version | Generated → Candidate → Official → Historical; Regeneration creates new Version |
| Playoff | Playoff/Bracket version meaning | Generated → Candidate → Official → Historical |
| Bracket | Versioned with Playoff | Generated → Candidate → Official → Historical; Match progression after Publish |
| Review | Associated with candidate Version | Pending → Approved/Rejected |
| Version | Generic version meaning | Generated → Candidate → Official → Historical |

Rules:

- Only one Official Version exists per artifact family.
- Historical Versions remain immutable.
- Versioning never changes Aggregate ownership.

---

# Entity Lifecycle Summary

| Entity | Lifecycle Summary |
| --- | --- |
| Tournament | Draft → Setup → Published → Live → Finished → Archived |
| Category | Created → configured → competition active → retained in Archive |
| Court | Configured → referenced → retained |
| Team | Registered → eligible/active → withdrawn(optional) → retained |
| Player | Assigned → replaced(optional) → retained in composition history |
| Drawing | Context exists; Versions: Generated → Reviewed → Published → Locked |
| Drawing Version | Generated → Candidate → Official/Historical |
| Group | Produced from Drawing → used in group stage → protected |
| Schedule | Context exists; Versions: Generated → Reviewed → Published → Locked |
| Schedule Version | Generated → Candidate → Official/Historical |
| Match | Waiting → Warm Up → Live → Finished → Verified |
| Standing | Updated on Verify; recalculated as needed; publish/lock as applicable |
| Playoff | Generated → Reviewed → Published → Locked; Matches progress after Publish |
| Bracket | Generated with Playoff → Published → advances on Verified playoff Matches |
| Champion | Created only after Playoff completion |
| Review | Pending → Approved/Rejected |
| Publish State | Unpublished → Published/Official |
| Lock State | Unlocked → Locked (Unlock exceptional) |
| Audit/Event Log | Append-only through retention |
| Referee Assignment | Assigned → active → unassigned/reassigned |

---

# Logical Constraints

Business constraints reflected by the logical model:

1. One Category belongs to exactly one Tournament.
2. One Team belongs to exactly one Category.
3. One Match belongs to exactly one Category.
4. One Court belongs to exactly one Tournament.
5. Schedule never owns Court; it only references Court.
6. Drawing never owns Team; placement is associative via Group Membership.
7. Tournament Engine owns no entities.
8. Only one Official Version exists per versioned artifact family.
9. Review never changes ownership.
10. Publish never bypasses Review where Review is required.
11. Champion requires Playoff completion.
12. Verified Match is required for official Standing update from that Match.
13. Groups depend on Drawing placements.
14. Playoff depends on qualification Standings.
15. Verified Match cannot return to Waiting.
16. Published/historical Versions are never deleted.
17. Locked artifacts require Unlock before unrestricted modification.
18. Match belongs to either Group stage or Playoff stage structure.
19. Active Referee Assignment does not transfer Match ownership.
20. Archived Tournament is terminal for competition changes in V1.

---

# Out of Scope

Explicitly excluded from this Logical ERD:

- Database engine choice
- ORM / Prisma
- Indexes
- SQL / DDL
- Migration scripts
- Performance tuning
- Partitioning
- Physical security controls
- API contracts
- WebSocket contracts
- Caching technology
- Storage formats and column types

Those belong to Physical Database Design and later interface/architecture documents.

---

# Traceability

```text
Business Architecture
(Charter, Glossary, Domain Model, Business Rules, Engine Spec, SRS)
↓
Conceptual Data Model
↓
Logical ERD (this document)
↓
Physical Database Design
↓
REST API
↓
WebSocket
↓
Backend
↓
Frontend
```

Physical Database Design must be derivable directly from this Logical ERD without redefining business meaning.

---

# Document Summary

| Metric | Count |
| --- | --- |
| Total Logical Entities | 28 |
| Total Core Entities | 14 |
| Total Generated Entities | 4 |
| Total Associative Entities | 4 |
| Total Supporting Entities | 3 |
| Total Conceptual State Concepts | 3 |
| Total Attributes | 236 |
| Total Relationships | 40 |
| Total Business Identifiers | 24 |
| Total Derived Attributes | 9 |
| Total Versioned Entities | 6 |
| Total Reference Concepts | 12 |

Classification counts are organizational. Business meaning, ownership, relationships, cardinality, optionality, identifiers, constraints, and lifecycles remain unchanged from v0.1.0.

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Principal Data Architect | Initial Logical Entity Relationship Model derived from Conceptual Data Model v0.1.2 |
| 0.1.1 | 2026-07-25 | Principal Data Architect | Enterprise refinement: Entity Classification, Common Attribute Profiles, Attribute Ownership Principles, Entity Dependency Hierarchy, Conceptual State Concepts, Entity Summary Table; no business redesign |

---

*This Logical ERD is the governing logical data structure for Set Point. Physical Database Design and subsequent interface/backend designs must remain consistent with the entities, attributes, relationships, cardinality, optionality, and constraints defined herein without redefining business meaning.*
