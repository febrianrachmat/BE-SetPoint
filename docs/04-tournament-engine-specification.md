# Tournament Engine Specification

| Field | Value |
| --- | --- |
| Document | Tournament Engine Specification |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Foundation Sprint |
| Classification | Internal — Business Capability |
| Last Updated | 2026-07-25 |
| Depends On | `00-project-charter.md`, `01-product-glossary.md`, `02-domain-model.md`, `03-business-rules.md` |

---

## Purpose

The Tournament Engine exists to provide intelligent automation for Set Point competition preparation and progression.

**Responsibility**

Generate recommendations and tournament artifacts—such as Drawing, Groups, Schedule, Standings calculations, Playoff, and Bracket—according to Business Rules, while remaining subject to Tournament Admin Review and approval.

**Boundaries**

- The Tournament Engine is a **Business Capability**.
- The Tournament Engine is **not** an Aggregate.
- The Tournament Engine is **not** an Entity.
- The Tournament Engine is **not** an Owner.
- The Tournament Engine generates artifacts **inside** Aggregate ownership boundaries defined by the Business Domain Model.
- The Tournament Engine executes business behavior already defined in Business Rules; it does not invent or override that behavior.

**Business Rules vs Tournament Engine**

| Concern | Document |
| --- | --- |
| Vocabulary | Product Glossary |
| Structure and ownership | Business Domain Model |
| Behavior and authority | Business Rules |
| **Generation capability, inputs, outputs, constraints** | **Tournament Engine Specification** |

Business Rules define what must happen and who decides.  
Tournament Engine Specification defines what the Engine may generate, consume, detect, and recommend—never what it may approve, publish, lock, or own.

---

## Engine Principles

1. **Automation First** — Prefer Engine generation of competition artifacts over manual assembly.
2. **Human Always in Control** — Final approval always belongs to Tournament Admin.
3. **Deterministic Generation** — Same business inputs and Drawing Seed produce the same Drawing result.
4. **Reproducibility** — Generated outcomes that depend on seed/inputs must be reproducible.
5. **Auditability** — Generation, Replay, Regeneration, validation, recommendation, and failure detection are auditable business events.
6. **Versioning** — Replay and Regeneration create new versions; older versions remain immutable.
7. **No Ownership** — Engine never owns Tournament, Category, or any business entity/artifact.
8. **No Automatic Publish** — Engine never Publishes.
9. **No Automatic Lock** — Engine never Locks as a substitute for Tournament Admin decision.
10. **Technology Independent** — This specification remains true regardless of language, runtime, API, or storage.

---

# Engine Responsibilities

The Tournament Engine is responsible for:

- Generate Drawing
- Generate Groups
- Generate Schedule
- Calculate Standings
- Generate Playoff
- Generate Bracket
- Recommend Court Assignment
- Recommend Match Ordering
- Validate Competition Structure
- Detect Scheduling Conflicts
- Generate Versioned Artifacts
- Support Drawing Replay
- Support Schedule Regeneration
- Support Standing Recalculation
- Record generation outcomes for Audit/Event history (business-meaningful)

The Tournament Engine must:

- Never approve Review
- Never Publish
- Never Lock
- Never Unlock
- Never own data
- Never declare Champion
- Never change Tournament Lifecycle
- Never override Tournament Admin decisions
- Never delete history
- Never bypass Review, Publish, or Lock rules

---

# Engine Inputs

## Drawing

**Inputs**

- Category
- Eligible Teams
- Drawing Seed (generated/retained for reproducibility)
- Category Configuration
- Business Rules

**Output**

- Drawing Artifact
- Version
- History
- Review Required: Yes

---

## Groups

**Inputs**

- Category
- Official or candidate Drawing placements
- Category Configuration
- Business Rules

**Output**

- Groups Artifact / Group structure
- Version
- History
- Review Required: Yes (as part of Drawing/Group officialization path)

---

## Schedule

**Inputs**

- Category
- Groups (for group stage) and/or Playoff structure (for playoff stage, when applicable)
- Matches to be scheduled
- Tournament Courts (referenced, not owned)
- Category Configuration
- Existing Schedule version (for regeneration)
- Business Rules

**Output**

- Schedule Artifact
- Court assignment recommendations
- Match ordering recommendations
- Version
- History
- Review Required: Yes

---

## Standing

**Inputs**

- Category
- Groups (where applicable)
- Verified Match results
- Category ranking criteria (business criteria; not algorithm detail)
- Business Rules

**Output**

- Standings Artifact / calculated Standings
- Qualification view toward Playoff
- Version (when recalculated as a new versioned outcome)
- History
- Review Required: Not for routine automatic update after Verify; Yes for contested/manual recalculation path before Publish where applicable

---

## Playoff

**Inputs**

- Category
- Standings / qualification outcomes
- Category Configuration
- Business Rules

**Output**

- Playoff Artifact
- Version
- History
- Review Required: Yes

---

## Bracket

**Inputs**

- Category
- Playoff definition
- Qualified Teams
- Category Configuration
- Business Rules

**Output**

- Bracket Artifact
- Version
- History
- Review Required: Yes (with Playoff)

---

# Engine Outputs

## Drawing

| Aspect | Definition |
| --- | --- |
| Purpose | Officializable group-placement artifact for a Category |
| Owner | Category |
| Versioning | Yes — Replay creates a new version |
| Review Requirement | Mandatory before Publish |
| Publish Requirement | Required to become official |
| Lock Relationship | Lock prevents unrestricted Replay/modification |
| Consumers | Groups, Tournament Admin, Audit/Event history |

## Groups

| Aspect | Definition |
| --- | --- |
| Purpose | Preliminary competition structure derived from Drawing |
| Owner | Category |
| Versioning | Yes — tied to Drawing version/history |
| Review Requirement | Yes before official use |
| Publish Requirement | Yes for official Category structure |
| Lock Relationship | Locked with Drawing/Group integrity rules |
| Consumers | Schedule, Standings, Matches (group stage) |

## Schedule

| Aspect | Definition |
| --- | --- |
| Purpose | Ordered plan of Matches with timing and Court references |
| Owner | Category |
| Versioning | Yes — Regeneration creates a new version |
| Review Requirement | Mandatory before Publish |
| Publish Requirement | Required for official consumption |
| Lock Relationship | Lock prevents unrestricted regeneration |
| Consumers | Match operations, Referees, Public Viewer, TV Display |

## Standings

| Aspect | Definition |
| --- | --- |
| Purpose | Ranked competitive positions from Verified results |
| Owner | Category |
| Versioning | Recalculation produces auditable updated outcome/version |
| Review Requirement | Routine updates follow Verify; Publish path applies for public official Standings |
| Publish Requirement | Required for Public Viewer / TV Display official Standings |
| Lock Relationship | Lock restricts unrestricted recalculation |
| Consumers | Playoff qualification, Public Viewer, TV Display, Tournament Admin |

## Playoff

| Aspect | Definition |
| --- | --- |
| Purpose | Post-group competition stage artifact |
| Owner | Category |
| Versioning | Yes |
| Review Requirement | Mandatory before Publish |
| Publish Requirement | Required to become official |
| Lock Relationship | Lock prevents unrestricted structural rebuild |
| Consumers | Bracket, Matches (playoff stage), Tournament Admin |

## Bracket

| Aspect | Definition |
| --- | --- |
| Purpose | Structured map of Playoff Matches and progression |
| Owner | Playoff (within Category) |
| Versioning | Yes |
| Review Requirement | Mandatory with Playoff before Publish |
| Publish Requirement | Required for official public/operational Bracket |
| Lock Relationship | Lock prevents unrestricted regeneration |
| Consumers | Playoff Matches, Public Viewer, TV Display, Champion path |

---

# Engine Capabilities

## Drawing Engine

**Purpose**

Generate the Drawing artifact that places eligible Teams into Groups for a Category, including Drawing Seed for reproducibility.

**Inputs**

Category, Eligible Teams, Drawing Seed, Category Configuration, Business Rules

**Outputs**

Drawing Artifact, Version, History, Review-required candidate

**Constraints**

- Must belong to one Category
- Must be reproducible with the same inputs and Drawing Seed
- Must not Publish or approve itself
- Drawing Seed is not team ranking / tournament seeding

**Dependencies**

Eligible Teams; Category in an Engine-allowed Tournament Lifecycle state

**Failure Conditions**

Insufficient Teams; Invalid Category Configuration; Invalid Tournament State; Duplicate Team/Player detected by Validation Engine

---

## Group Generation Engine

**Purpose**

Generate Group structure from Drawing placements.

**Inputs**

Category, Drawing placements, Category Configuration, Business Rules

**Outputs**

Groups, Version/history linkage to Drawing, Review-required structure

**Constraints**

- Groups cannot be official before Drawing produces placements
- Must remain inside Category ownership
- Must not erase prior Drawing/Group history on regeneration path

**Dependencies**

Drawing Engine output

**Failure Conditions**

Missing Drawing; Invalid Drawing version; Invalid Category Configuration; Invalid Tournament State

---

## Schedule Engine

**Purpose**

Generate Schedule artifact: Match timing plan and Court assignment references for a Category.

**Inputs**

Category, Groups and/or Playoff Matches, Tournament Courts, Category Configuration, existing Schedule version (optional), Business Rules

**Outputs**

Schedule Artifact, Court assignment recommendations, Match ordering recommendations, Version, History

**Constraints**

- Schedule owns scheduling decisions, not Courts
- Must detect Court conflicts and Team conflicts (via Validation Engine)
- Must not Publish/Lock
- Regeneration creates a new version

**Dependencies**

Groups (group stage); Courts owned by Tournament; Validation Engine; Recommendation Engine

**Failure Conditions**

Schedule impossible; Court unavailable; Conflicting Matches; Invalid Tournament State; Missing Groups/Matches

---

## Standing Engine

**Purpose**

Calculate Standings from Verified Match results and support Standing Recalculation.

**Inputs**

Category, Groups (as applicable), Verified Match results, Category ranking criteria, Business Rules

**Outputs**

Standings, qualification view, auditable recalculation outcome

**Constraints**

- Uses Verified results only for official Standing updates
- Does not invent tie-break algorithms here; applies Category business criteria
- Does not declare Playoff winners or Champion

**Dependencies**

Verified Matches; Group context; Business Rules for ranking criteria existence

**Failure Conditions**

Missing Verified results where required; Tie-breaking ambiguity (detection only; Admin resolves); Invalid Tournament State

---

## Playoff Engine

**Purpose**

Generate Playoff and Bracket artifacts from qualification outcomes.

**Inputs**

Category, Standings/qualification, Category Configuration, Business Rules

**Outputs**

Playoff Artifact, Bracket Artifact, Version, History, Review-required candidates

**Constraints**

- Requires qualification inputs from Standings
- Must not Publish/approve
- Must not declare Champion
- Bracket updates from Verified playoff Match outcomes remain subject to Business Rules; Engine may compute progression recommendations/artifacts only

**Dependencies**

Standing Engine outputs; Category completion rules for group stage

**Failure Conditions**

Insufficient qualification data; Bracket impossible; Tie-breaking ambiguity unresolved; Invalid Tournament State; No Champion path possible under current inputs (detection only)

---

## Validation Engine

**Purpose**

Detect competition-structure and scheduling problems. Detection only—never automatic fix.

**Responsible for detecting**

- Duplicate Teams
- Duplicate Players
- Schedule Conflict
- Court Conflict
- Team Conflict
- Missing Players
- Invalid Category Configuration
- Insufficient Teams
- Invalid Tournament State

**Inputs**

Relevant Category/Tournament artifacts and candidate Engine outputs

**Outputs**

Validation results (pass/fail), failure reasons, audit-relevant detection events

**Constraints**

- Never fixes automatically
- Never Publishes, Locks, or approves
- Never changes ownership

**Dependencies**

All generation capabilities may invoke Validation before presenting Review candidates

**Failure Conditions**

Any detected violation blocks dependent generation/Publish readiness per Business Rules

---

## Recommendation Engine

**Purpose**

Suggest operational options to Tournament Admin without overriding decisions.

**Responsible for recommending**

- Court suggestions
- Time suggestions
- Sequence suggestions
- Bracket suggestions

**Inputs**

Category/Tournament context, Courts, Matches, constraints, Business Rules

**Outputs**

Recommendations (non-official), optionally attached to candidate artifacts

**Constraints**

- Never override Tournament Admin
- Never auto-apply as official without Admin acceptance path
- Never Publish or Lock

**Dependencies**

Schedule Engine, Playoff Engine, Validation Engine

**Failure Conditions**

No feasible recommendation under current constraints (report impossibility; Admin resolves)

---

# Engine Constraints

- Engine never owns entities.
- Engine never modifies Published history.
- Engine never bypasses Review.
- Engine never bypasses Lock.
- Engine never changes Aggregate ownership.
- Engine never deletes history.
- Engine never declares Champion.
- Engine never changes Tournament Lifecycle.
- Engine never assigns business authority.
- Engine never approves Review.
- Engine never Publishes.
- Engine never Locks or Unlocks.
- Engine never silently replaces Official Version.
- Engine never treats recommendations as official artifacts.

---

# Engine State Awareness

Which Tournament Lifecycle states allow which Engine capabilities under normal operations:

| Capability | Draft | Setup | Published | Live | Finished | Archived |
| --- | --- | --- | --- | --- | --- | --- |
| Drawing | No | Yes | Limited | No* | No | No |
| Groups | No | Yes | Limited | No* | No | No |
| Schedule | No | Yes | Yes | Yes | No | No |
| Standing | No | Preview only | Yes | Yes | Read/recalc exception only | No |
| Playoff | No | Draft only | Yes | Yes | No | No |
| Validation | Yes | Yes | Yes | Yes | Yes | Yes (read-only validation of historical consistency) |
| Recommendation | No | Yes | Yes | Yes | No | No |

**Notes**

- **Limited** in Published means only when Business Rules allow controlled preparation that does not destroy published integrity; Review/Publish/Lock still apply.
- **No*** for Drawing/Groups in Live under normal operations; Exception/Unlock paths are Admin-owned, not Engine-owned.
- **Preview only** Standings in Setup means non-official calculation support before Verified Live results exist.
- Archived allows validation for historical consistency checks only; no generative competition changes.

Exact permission to execute remains governed by Business Rules and Tournament Admin authority.

---

# Engine Versioning

**Replay**

Drawing Replay creates a new Drawing version using Drawing Seed / reproducibility rules. Prior Drawing history is preserved.

**Regeneration**

Schedule Regeneration (and equivalent regenerations for other generated artifacts) creates a new version. Silent replacement of Official Version is forbidden.

**Version Number**

Each generation, Replay, or Regeneration produces a distinct business version identity for the artifact.

**Official Version**

Only one version may be Official. Official status is created by Publish, not by Engine generation.

**Historical Version**

Older versions remain immutable and retained for auditability and fairness.

**Audit**

Version creation, Replay, Regeneration, and Official designation (via Publish) are auditable.

**Rollback Policy**

Rollback means selecting a prior version for Review/Publish consideration under Tournament Admin authority and Business Rules. Engine does not delete versions and does not auto-rollback. Locked/Published constraints still apply.

---

# Engine Failure Handling

| Failure | Detection | Business Response | Owner of Resolution |
| --- | --- | --- | --- |
| Insufficient Teams | Validation Engine before/during Drawing | Block Drawing generation | Tournament Admin (adjust Teams/Category) |
| Schedule impossible | Schedule + Validation Engines | Block Schedule candidate / Publish readiness | Tournament Admin |
| Court unavailable | Validation / Schedule Engines | Block conflicting assignment; recommend alternatives | Tournament Admin |
| Duplicate Team | Validation Engine | Block affected generation/registration path | Tournament Admin |
| Duplicate Player | Validation Engine | Block affected generation/registration path | Tournament Admin |
| No Champion | Playoff/Standing path detection when completion rules unmet | Block Tournament Finished under normal rules | Tournament Admin |
| Bracket impossible | Playoff Engine + Validation | Block Playoff/Bracket candidate | Tournament Admin |
| Conflicting Matches | Validation Engine (Court/Team conflicts) | Block Schedule Publish | Tournament Admin |
| Invalid State | State awareness + Validation | Refuse capability execution | Tournament Admin / Super Admin (governance only) |
| Tie-breaking ambiguity | Standing Engine detection | Block Playoff generation until resolved | Tournament Admin |
| Missing Players | Validation Engine | Block eligibility for Drawing/Match readiness | Tournament Admin |
| Invalid Category Configuration | Validation Engine | Block dependent generation | Tournament Admin |

Engine detects and reports. Engine does not auto-fix.

---

# Engine Audit Responsibilities

The Engine must ensure the following business-meaningful actions are recordable (storage mechanism out of scope):

- Generation of artifacts
- Drawing Replay
- Schedule Regeneration
- Standing Recalculation
- Validation detections (pass/fail and reason)
- Recommendation issuance (as advisory events, where relevant)
- Failure detection
- Version creation

Minimum business content aligns with Audit Rules:

- What capability ran
- Which Category/Tournament artifact was affected
- Which version was produced
- Whether Review is required
- Failure reason when generation cannot complete
- When the action occurred
- That Engine did not Publish/Lock/Approve

---

# Engine Dependency Graph

Generation order (business dependency, text only):

```text
Tournament
↓
Category
↓
Teams
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
```

Notes:

- Courts are Tournament-owned inputs referenced by Schedule; they are not generated by the Engine as owned resources.
- Champion is declared under Business Rules after Playoff completion; Engine does not declare Champion.
- Validation and Recommendation may run at multiple points; they do not replace this order.

---

# Engine Responsibility Matrix

| Capability | Consumes | Produces | Owner | Review | Publish | Lock | Audit | Version |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Drawing Engine | Category, Eligible Teams, Seed, Config, Rules | Drawing | Category | Required | Admin only | Admin only | Yes | Yes (Replay) |
| Group Generation Engine | Drawing, Config, Rules | Groups | Category | Required | Admin only | Admin only | Yes | Yes |
| Schedule Engine | Groups/Playoff Matches, Courts, Config, Rules | Schedule | Category | Required | Admin only | Admin only | Yes | Yes (Regeneration) |
| Standing Engine | Verified Matches, Criteria, Rules | Standings | Category | Publish path / contested recalc | Admin only | Admin only | Yes | Yes (Recalc) |
| Playoff Engine | Standings/qualification, Config, Rules | Playoff | Category | Required | Admin only | Admin only | Yes | Yes |
| Bracket (via Playoff Engine) | Playoff, Qualified Teams, Rules | Bracket | Playoff / Category | Required | Admin only | Admin only | Yes | Yes |
| Validation Engine | Candidate artifacts + context | Detection results | N/A (no ownership) | N/A | N/A | N/A | Yes | N/A |
| Recommendation Engine | Context + constraints | Suggestions | N/A (no ownership) | Admin decision | N/A | N/A | Yes | N/A |

Owner column means business owner of produced artifacts, never the Engine.

---

# Out of Scope

The Tournament Engine does **not** do:

- Authentication
- Authorization
- Frontend
- Database design or persistence
- API design
- WebSocket design
- Notifications
- Payments
- Scoring UI
- User Management
- Role Management
- Analytics
- Reporting
- Champion declaration
- Tournament Lifecycle transitions
- Review approval
- Publish
- Lock / Unlock
- Ownership of Aggregates or Entities
- Automatic conflict repair
- V2 capabilities explicitly out of product scope (for example Auto Optimize Engine, Quick Reschedule Suggestions)

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Lead Software Architect | Initial Tournament Engine Specification for Foundation Sprint |

---

*This Tournament Engine Specification defines the Set Point generation capability only. It must remain consistent with the Product Glossary, Business Domain Model, and Business Rules, and must never assume ownership, approval, Publish, or Lock authority.*
