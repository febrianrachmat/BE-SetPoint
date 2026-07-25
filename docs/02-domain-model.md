# Business Domain Model

| Field | Value |
| --- | --- |
| Document | Business Domain Model |
| Product | Set Point |
| Version | 0.1.1 |
| Status | Foundation Sprint |
| Classification | Internal — Domain Architecture |
| Last Updated | 2026-07-25 |
| Depends On | `00-project-charter.md`, `01-product-glossary.md` |

---

## Purpose

This Business Domain Model defines the Set Point business domain using Domain-Driven Design (DDD) principles.

It establishes:

- Core business entities
- Ownership boundaries
- Relationships between entities
- Aggregate roots and consistency boundaries

This document is intentionally **not** a database design, ERD, persistence schema, API design, class diagram, or technical architecture.

Its role is to make the business structure explicit so that Business Rules, Tournament Engine Specification, ERD, and later API design can all derive from one shared domain understanding—while remaining technology independent.

Terminology used here follows the Product Glossary as the single source of truth. This model does not redefine glossary terms.

Document responsibility boundaries:

- **Product Glossary** defines terminology.
- **Business Domain Model** defines entities, ownership, relationships, and aggregates.
- **Business Rules** define behavior.
- **Tournament Engine Specification** defines generation logic.

---

## Modeling Principles

1. **Business first** — Model the padel tournament business, not software components.
2. **Technology independent** — No tables, keys, schemas, APIs, DTOs, or UI concepts.
3. **One source of truth** — Entity names and meanings come from the Product Glossary.
4. **Aggregate ownership** — Every important business object has a clear owner and consistency boundary.
5. **Explicit relationships** — Relationships are stated in business language, not technical joins.
6. **Rich domain language** — Prefer glossary terms (Tournament, Category, Drawing, Standing, Lock, Publish) over informal synonyms.
7. **Human control over automation** — Generated artifacts remain owned by the business aggregates and subject to Tournament Admin approval.
8. **Lifecycle awareness** — Tournament Lifecycle and Match Status are first-class domain states, not technical flags.

---

## Domain Overview

Conceptual model of the Set Point business domain:

```text
Tournament
├── Categories
│   ├── Teams
│   │   └── Players
│   ├── Drawing
│   │   └── Drawing Seed
│   ├── Groups
│   │   └── Matches (group stage)
│   ├── Schedule
│   ├── Standings
│   └── Playoff
│       ├── Bracket
│       ├── Matches (playoff stage)
│       └── Champion
├── Courts
├── Sponsors
├── Gallery
├── Audit Log
└── Event Log
```

Supporting domain capabilities that operate across this model:

- **Tournament Engine** — generates recommendations and artifacts within these ownership boundaries
- **TV Display / Public Viewer** — consume published tournament information; they are experiences, not owning aggregates
- **Roles** — Super Admin, Tournament Admin, Referee, Guest act on the domain; they are not structural containers

This is a conceptual model only.

---

## Core Business Entities

### Tournament

**Purpose**

Highest-level business container for a single competitive padel event.

**Responsibilities**

- Bound the full tournament lifecycle from Draft through Archived
- Own tournament-level resources and categories
- Provide the operational boundary for Tournament Admin control
- Host publishable and archivable tournament records

**Owned By**

Platform scope (created and governed as a top-level business entity)

**Owns**

Categories, Courts, Sponsors, Gallery, Audit Log, Event Log

**Related Entities**

Category, Court, Sponsor, Gallery, Schedule, Tournament Admin, Audit Log, Event Log

**Lifecycle Notes**

Progresses through Tournament Lifecycle states: Draft → Setup → Published → Live → Finished → Archived. Transition behavior is defined by Business Rules.

---

### Category

**Purpose**

Competitive division within a Tournament under a shared set of competition rules and structure.

**Responsibilities**

- Separate participants into distinct competitive tracks
- Own competition structure: Teams, Drawing, Groups, Matches, Schedule, Standings, Playoff
- Bound group-stage and playoff competition for that division
- Provide the consistency boundary for Match lifecycle, Standings, and Schedule within the Category
- Hold Category-level generated artifacts subject to Review, Publish, and Lock

**Owned By**

Tournament

**Owns**

Teams, Drawing, Groups, Matches, Schedule, Standings, Playoff

**Related Entities**

Tournament, Team, Player, Group, Match, Standing, Playoff, Bracket, Champion

**Lifecycle Notes**

Competition inside a Category advances from registration and Drawing through group play, Standings, Playoff, and Champion declaration according to Business Rules.

---

### Team

**Purpose**

Primary competing unit registered in a Category.

**Responsibilities**

- Represent the side that enters Drawing, Groups, Matches, Standings, and Playoff
- Hold Player composition according to Category format
- Accumulate competitive outcomes within the Category

**Owned By**

Category

**Owns**

Player composition (Players assigned to the Team)

**Related Entities**

Category, Player, Group, Match, Standing, Drawing

**Lifecycle Notes**

A Team exists within the Category for the duration of that Category’s competition. Membership rules are defined by Business Rules.

---

### Player

**Purpose**

Individual participant who may be assigned to a Team.

**Responsibilities**

- Identify the person participating in competition
- Appear in Team composition and Match participation context

**Owned By**

Team (composition ownership within a Category)

**Owns**

None

**Related Entities**

Team, Category, Tournament

**Lifecycle Notes**

Player identity is meaningful in the context of Team assignment and Match participation. Cross-tournament player identity beyond V1 scope is not modeled here.

---

### Group

**Purpose**

Subdivision of Teams within a Category for preliminary / pool-stage competition.

**Responsibilities**

- Contain the Teams assigned through Drawing
- Own group-stage Matches among those Teams
- Provide the context for group-level Standings

**Owned By**

Category

**Owns**

Group-stage Matches

**Related Entities**

Category, Team, Match, Standing, Drawing

**Lifecycle Notes**

Groups are produced through Drawing / Group Generation by the Tournament Engine and remain editable under Tournament Admin control until Lock rules apply.

---

### Match

**Purpose**

Atomic competitive contest between competing sides within a Category.

**Responsibilities**

- Represent a scheduled contest with Court and timing context
- Progress through Match Status values
- Produce results that affect Standings and Playoff progression

**Owned By**

Category (Aggregate Root)

Structurally placed under:

- Group, when the Match belongs to the group stage
- Playoff, when the Match belongs to the playoff stage

Match is an Entity inside the Category aggregate. It is not an independent Aggregate Root in Set Point V1.

**Owns**

Match result information once play completes and is Verified according to Business Rules

**Related Entities**

Category, Group, Playoff, Bracket, Team, Court, Schedule, Standing, Referee

**Lifecycle Notes**

Progresses through Match Status: Waiting → Warm Up → Live → Finished → Verified. A Match in Live status is a Live Match. Match lifecycle is governed by Category competition rules. Behavior is defined by Business Rules.

---

### Standing

**Purpose**

Ranked competitive position of a Team within a Group or Category context based on recorded Match results.

**Responsibilities**

- Reflect relative performance
- Support qualification decisions toward Playoff
- Remain consistent with Verified Match results

**Owned By**

Category

**Owns**

None (derived competitive state within Category ownership)

**Related Entities**

Category, Group, Team, Match, Playoff

**Lifecycle Notes**

Standings change as Matches become Verified. Ranking criteria and update behavior are defined by Business Rules; generation/calculation logic belongs to the Tournament Engine Specification.

---

### Playoff

**Purpose**

Post-group competitive stage of a Category that leads to a Champion.

**Responsibilities**

- Define the elimination / final-stage competition path
- Own Bracket and playoff-stage Matches
- Culminate in Champion declaration

**Owned By**

Category

**Owns**

Bracket, playoff-stage Matches, Champion outcome

**Related Entities**

Category, Standing, Bracket, Match, Champion, Team

**Lifecycle Notes**

Playoff is generated from qualification outcomes and remains subject to Review, Publish, and Lock under Business Rules.

---

### Bracket

**Purpose**

Structured map of Playoff Matches showing progression paths to the final.

**Responsibilities**

- Represent playoff advancement structure
- Associate playoff slots and Matches through the Playoff path
- Make progression understandable and operable for organizers and public views

**Owned By**

Playoff

**Owns**

None beyond its structural representation of Playoff Matches

**Related Entities**

Playoff, Match, Champion, Category

**Lifecycle Notes**

Bracket is a generated artifact. It remains editable under Tournament Admin control until Lock rules apply.

---

### Court

**Purpose**

Playable venue resource within a Tournament where Matches can be scheduled and conducted.

**Responsibilities**

- Provide location assignment for Schedule and live operations
- Host many Matches over the life of the Tournament

**Owned By**

Tournament

**Owns**

None

**Related Entities**

Tournament, Match, Schedule

**Lifecycle Notes**

Courts are tournament resources configured during Setup and used during Published and Live tournament states.

---

### Sponsor

**Purpose**

Business entity representing a sponsor associated with a Tournament.

**Responsibilities**

- Belong to the Tournament’s commercial / presentation context
- Support sponsor presence for public and on-site experiences according to product scope

**Owned By**

Tournament

**Owns**

None

**Related Entities**

Tournament, Gallery, Public Viewer, TV Display

**Lifecycle Notes**

Sponsors are tournament-level resources. Presentation rules are defined by Business Rules and later experience specifications.

---

### Gallery

**Purpose**

Tournament-owned media collection associated with the event.

**Responsibilities**

- Hold gallery content belonging to the Tournament
- Support public and event presentation needs within V1 scope

**Owned By**

Tournament

**Owns**

Gallery content items as tournament media resources

**Related Entities**

Tournament, Sponsor, Public Viewer

**Lifecycle Notes**

Gallery belongs to the Tournament across its lifecycle and may remain available when the Tournament is Archived according to Business Rules.

---

### Schedule

**Purpose**

Ordered plan of Matches for a Category, including timing and Court assignments.

**Responsibilities**

- Own scheduling decisions for Matches within the Category
- Coordinate when Matches are played and which Tournament Court each Match references
- Serve as a generated, reviewable, and publishable business artifact

**Owned By**

Category

**Owns**

Scheduling decisions and scheduled Match placements (timing and Court assignment references)

**Related Entities**

Category, Match, Court, Tournament, Publish, Lock

**Lifecycle Notes**

Schedule is generated by the Tournament Engine, reviewed by Tournament Admin, and may be Published for Referees, Public Viewer, and TV Display. Schedule references Tournament Courts; Courts remain owned by Tournament. Schedule never owns Court resources. Lock behavior is defined by Business Rules.

---

### Drawing

**Purpose**

Generated Business Artifact owned by Category that records the official placement of Teams into Groups.

**Responsibilities**

- Represent the Category’s official group-placement artifact
- Carry Drawing Seed for reproducibility
- Support Drawing Replay without losing history
- Remain subject to Tournament Admin Review, approval, Publish, and Lock

**Owned By**

Category

**Owns**

Drawing Seed, Drawing history relevant to that Category

**Related Entities**

Category, Team, Group, Drawing Seed, Drawing Replay, Tournament Engine, Audit Log

**Lifecycle Notes**

The Tournament Engine generates Drawing. The Tournament Admin reviews and approves Drawing. Drawing becomes an official business artifact after Publish. Drawing is reproducible through Drawing Seed. Drawing is not merely a process; it is a durable Category-owned artifact with history.

---

### Champion

**Purpose**

Official competitive outcome of a completed Playoff.

**Responsibilities**

- Represent the declared Category winner
- Mark the culminating competitive result of the Category

**Owned By**

Playoff (derived outcome of Playoff completion)

**Owns**

None

**Related Entities**

Playoff, Bracket, Category, Team, Tournament

**Lifecycle Notes**

Champion is a business outcome, not an independent Aggregate Root and not an entity with its own lifecycle. Champion exists only after successful Playoff completion. Champion is derived from Playoff rather than acting as an independent business aggregate. It remains in the domain because of its business significance. Declaration rules are defined by Business Rules.

---

## Aggregate Roots

Aggregate Roots in Set Point are business concepts. They define:

- **Ownership boundaries** — what belongs inside the aggregate
- **Consistency boundaries** — what must remain business-consistent together
- **Transaction boundaries from a business perspective** — which changes must be reasoned about as one business unit

Aggregate Roots are not persistence models, storage units, or technical service boundaries.

Official Aggregate Roots for Set Point V1:

### Tournament

**Reason**

Highest business boundary for a single event.

Owns all tournament-level resources and Categories.

Defines the ownership, consistency, and business transaction boundary for Tournament Lifecycle, Courts, Sponsors, Gallery, and tournament-wide Audit Log / Event Log context.

### Category

**Reason**

Competition boundary within a Tournament.

Owns Teams, Drawing, Groups, Matches, Schedule, Standings, and Playoff.

Defines the ownership, consistency, and business transaction boundary for competition generation, Match lifecycle, group play, Standings, Schedule, and playoff progression.

For Set Point V1 (initial monolithic architecture), Match remains an Entity inside the Category aggregate rather than an independent Aggregate Root because:

- Match cannot exist outside a Category
- Match lifecycle is governed by Category competition
- Standings, Schedule, Groups, and Playoff belong to the same competition boundary
- Keeping Match inside Category simplifies transactional consistency across Live Operations and competition outcomes

> Only Aggregate Roots are identified here. This document does not implement aggregates or technical persistence designs.

---

## Ownership Rules

Ownership is conceptual and defines where business consistency is enforced.

1. **Tournament owns Categories.**  
   A Category cannot exist outside a Tournament.

2. **Tournament owns Courts.**  
   Courts are shared tournament resources available for scheduling across Categories.

3. **Tournament owns Sponsors.**  
   Sponsor association is tournament-scoped.

4. **Tournament owns Gallery.**  
   Gallery content belongs to the Tournament.

5. **Tournament owns Audit Log and Event Log context for the event.**  
   Accountability and domain history are retained with the Tournament.

6. **Category owns Teams.**  
   Teams are registered and compete inside one Category.

7. **Team owns Player composition.**  
   Players participate through Team membership in that Category.

8. **Category owns Drawing.**  
   Drawing is a Generated Business Artifact of the Category. Drawing Seed and Drawing history belong with that artifact.

9. **Category owns Groups.**  
   Groups are the Category’s preliminary structure.

10. **Category owns Matches.**  
    All Matches belong to the Category aggregate for consistency.  
    Group structurally contains group-stage Matches.  
    Playoff structurally contains playoff-stage Matches.

11. **Category owns Schedule.**  
    Schedule owns scheduling decisions for the Category.  
    Schedule references Courts owned by Tournament.  
    Schedule never owns Court resources.

12. **Category owns Standings.**  
    Standings are the Category’s competitive ranking state (including group context).

13. **Category owns Playoff.**  
    Post-group competition belongs to the Category.

14. **Playoff owns Bracket.**  
    Bracket is the Playoff’s structural map.

15. **Playoff derives Champion.**  
    Champion is the official competitive outcome after successful Playoff completion, not an independent aggregate.

Ownership implies:

- Child entities are created, changed, published, locked, or archived within the parent’s business boundary.
- The Tournament Engine may generate child artifacts, but ownership does not transfer to the engine.
- Final approval remains with the Tournament Admin.

---

## Relationship Principles

Relationships are expressed in business language:

- A Tournament contains one or more Categories.
- A Tournament contains zero or more Courts, Sponsors, and Gallery content.
- A Category contains one or more Teams.
- A Team is composed of one or more Players according to Category format.
- A Category has one Drawing artifact for group placement.
- A Drawing uses one Drawing Seed for reproducibility.
- A Drawing becomes official after Publish.
- A Category contains zero or more Groups after Drawing.
- A Group contains multiple Teams and the Matches among them.
- A Category has a Schedule of Matches.
- A Match belongs to exactly one Category.
- A Match belongs to either a Group or a Playoff stage.
- A Court may host many Matches over time.
- A Team participates in many Matches within its Category.
- A Category maintains Standings derived from Verified Match results.
- A Category may have one Playoff.
- A Playoff has one Bracket.
- A Playoff produces one Champion.
- Published artifacts are consumed by Tournament Admins, Referees, Public Viewer, and TV Display according to Business Rules.

Cross-boundary references:

- Schedule and Matches reference Courts owned by Tournament; they do not own Courts.
- Public Experience reads published Tournament and Category information but does not own it.
- Roles act on entities; they do not own structural tournament data.

---

## Domain Boundaries

Logical domain areas inside Set Point:

### Tournament Management

**Concern**

Creating and governing the Tournament as an operational event.

**Entities**

Tournament, Category, Court, Sponsor, Gallery

**Notes**

Includes Tournament Lifecycle progression and tournament-level resource setup.

---

### Competition

**Concern**

How participants are structured and how competitive progression works.

**Entities**

Category, Team, Player, Drawing, Group, Standing, Playoff, Bracket, Champion

**Notes**

Core competitive meaning of Set Point. Tournament Engine generation primarily serves this boundary under Tournament Admin approval.

---

### Scheduling

**Concern**

When and where Matches are played.

**Entities**

Schedule, Match, Court, Category, Tournament

**Notes**

Schedule owns scheduling decisions and connects Competition to Tournament Courts by reference. Publish and Lock rules protect schedule integrity.

---

### Live Operations

**Concern**

Running Matches in real time with human-controlled scoring and verification.

**Entities**

Match, Live Match concept, Standing, Court, Referee, Tournament Admin

**Notes**

Centered on Match Status transitions and Standing updates from Verified results. In V1, these changes remain inside the Category consistency boundary.

---

### Public Experience

**Concern**

Consuming published tournament information without operational authority.

**Entities / Concepts**

Public Viewer, TV Display, Guest, published Schedule, Standing, Bracket, Sponsor, Gallery

**Notes**

This boundary reads from Tournament Management, Competition, Scheduling, and Live Operations. It does not own source entities.

---

### Administration

**Concern**

Control, accountability, and platform governance.

**Entities / Concepts**

Super Admin, Tournament Admin, Review, Publish, Lock, Archive, Audit Log, Event Log, Tournament Engine (as generating capability)

**Notes**

Reinforces Automation First, Human Always in Control. Administration governs actions over aggregates; it is not a separate data owner of Categories or Matches.

---

## Domain Events Preview

Preview of meaningful business events in the domain. Names are business language only. Implementation is out of scope.

- Tournament Created
- Tournament Moved to Setup
- Tournament Published
- Tournament Went Live
- Tournament Finished
- Tournament Archived
- Category Created
- Team Registered
- Drawing Generated
- Drawing Replayed
- Drawing Locked
- Groups Generated
- Schedule Generated
- Schedule Regenerated
- Schedule Published
- Match Scheduled
- Match Rescheduled
- Referee Assigned
- Match Warm Up Started
- Match Started
- Score Updated
- Match Finished
- Match Verified
- Standing Updated
- Standing Recalculated
- Playoff Generated
- Bracket Published
- Champion Declared
- Artifact Reviewed
- Artifact Locked

Behavior associated with these events is defined by Business Rules. Generation associated with these events is defined by the Tournament Engine Specification.

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Lead Software Architect | Initial Business Domain Model for Foundation Sprint |
| 0.1.1 | 2026-07-25 | Lead Software Architect | Architecture review: Aggregate Roots, Drawing, Schedule, Champion, Domain Events |

---

*This Business Domain Model is the governing structural view of the Set Point business domain. ERD, Business Rules, and Tournament Engine Specification must remain consistent with the entities, ownership, and aggregate boundaries defined herein.*
