# Software Requirements Specification

| Field | Value |
| --- | --- |
| Document | Software Requirements Specification |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Foundation Sprint |
| Classification | Internal — Software Requirements |
| Last Updated | 2026-07-25 |
| Depends On | `00-project-charter.md`, `01-product-glossary.md`, `02-domain-model.md`, `03-business-rules.md`, `04-tournament-engine-specification.md` |

---

## Purpose

This Software Requirements Specification (SRS) translates Set Point Business Architecture into implementable software requirements.

It defines what the software system shall do and how well it shall perform, so that frontend, backend, QA, Product Owners, and architects can derive delivery work without redefining business truth.

**Relationship to foundation documents**

| Document | Authority |
| --- | --- |
| Product Glossary | Vocabulary |
| Business Domain Model | Structure and ownership |
| Business Rules | Business behavior and authority |
| Tournament Engine Specification | Generation capability boundaries |
| **SRS** | **Software features, workflows, NFRs, and acceptance criteria** |

The SRS must not redefine terminology, ownership, Business Rules, or Tournament Engine responsibilities. Where behavior is constrained by Business Rules or Engine boundaries, requirements reference those documents as authoritative.

This SRS does not define database schema, API endpoints, frontend implementation, backend implementation, or source code.

---

# Stakeholders

| Stakeholder | Responsibilities |
| --- | --- |
| Super Admin | Platform-level governance across Tournaments; exceptional governance actions with audit |
| Tournament Admin | Configure and operate a Tournament; Review, Publish, Lock; approve Engine outputs; resolve exceptions |
| Referee | Operate assigned Matches; submit scores; transition Match Status within authority |
| Public Viewer | Consume published tournament information without operational authority |
| TV Display | Consume published/live presentation information for on-site screens |
| Future API Consumers | Read-only integrations consuming published tournament information (V1 readiness as a stakeholder need; detailed integration contract later) |

---

# System Scope

## In Scope (V1)

- Tournament Management
- Category Management
- Team & Player Management
- Drawing
- Group Generation
- Schedule Management
- Match Management
- Live Scoring
- Standings
- Playoff / Bracket
- Gallery
- Sponsors
- Public Viewer
- TV Display
- Authentication & session access for operational roles
- Audit Log and Event Log
- Export of tournament records
- Tournament Archive
- Tournament Engine generation capabilities (as specified)
- Review, Publish, Lock, Versioning behavior for generated artifacts

## Out of Scope (V1)

Listed in full under **Out of Scope**. Includes Payments, Online Registration marketplace flows, QR Check-In, native mobile apps, multi-sport, AI Tournament Assistant, Auto Optimize Engine, Quick Reschedule Suggestions, and related exclusions from the Project Charter.

---

# Functional Requirements

Priority legend: **Must** / **Should** / **Could**

---

## Authentication Module

### AUTH-001 — Authenticate Operational Users

| Field | Content |
| --- | --- |
| Title | Authenticate operational users |
| Description | The system shall authenticate Super Admin, Tournament Admin, and Referee before granting operational capabilities. |
| Primary Actor | Super Admin, Tournament Admin, Referee |
| Preconditions | User has valid credentials/access entitlement |
| Main Flow | User authenticates → system establishes authorized session → role-appropriate capabilities become available |
| Postconditions | Authenticated session exists; Guest/public access remains separate |
| Acceptance Criteria | Unauthenticated users cannot perform Tournament Admin or Referee actions; failed authentication denies operational access |
| Priority | Must |

### AUTH-002 — Enforce Role-Based Access

| Field | Content |
| --- | --- |
| Title | Enforce role-based access |
| Description | The system shall restrict actions according to Super Admin, Tournament Admin, Referee, Guest, Public Viewer, and TV Display responsibilities defined in Business Rules. |
| Primary Actor | System |
| Preconditions | Actor identity/role is known (authenticated or public) |
| Main Flow | Actor attempts action → system evaluates role authority → allow or deny |
| Postconditions | Unauthorized actions are rejected; authorized actions proceed |
| Acceptance Criteria | Referee cannot Publish Drawing; Guest cannot score; Tournament Admin can Review/Publish within Tournament scope |
| Priority | Must |

### AUTH-003 — End Operational Session

| Field | Content |
| --- | --- |
| Title | End operational session |
| Description | The system shall allow authenticated users to end their session and shall invalidate operational access afterward. |
| Primary Actor | Super Admin, Tournament Admin, Referee |
| Preconditions | Active authenticated session |
| Main Flow | User ends session → system invalidates session |
| Postconditions | Operational actions require re-authentication |
| Acceptance Criteria | After session end, previously authorized operational requests are denied |
| Priority | Must |

---

## Tournament Module

### TOUR-001 — Create Tournament

| Field | Content |
| --- | --- |
| Title | Create Tournament |
| Description | The system shall allow Tournament Admin (or Super Admin per governance) to create a Tournament in Draft. |
| Primary Actor | Tournament Admin |
| Preconditions | Actor authorized |
| Main Flow | Actor provides Tournament identity → system creates Tournament in Draft |
| Postconditions | Tournament exists in Draft; Audit/Event recorded |
| Acceptance Criteria | New Tournament starts in Draft; appears only to authorized operators until Published lifecycle rules allow broader visibility |
| Priority | Must |

### TOUR-002 — Manage Tournament Lifecycle

| Field | Content |
| --- | --- |
| Title | Manage Tournament Lifecycle transitions |
| Description | The system shall support Tournament Lifecycle transitions Draft → Setup → Published → Live → Finished → Archived according to Business Rules. |
| Primary Actor | Tournament Admin |
| Preconditions | Transition entry conditions satisfied |
| Main Flow | Admin requests transition → system validates rules → state updates → audit recorded |
| Postconditions | Tournament is in new lifecycle state |
| Acceptance Criteria | Illegal transitions are rejected; Archived is terminal in V1 |
| Priority | Must |

### TOUR-003 — Configure Tournament Resources

| Field | Content |
| --- | --- |
| Title | Configure Courts, Sponsors, Gallery association |
| Description | The system shall allow Tournament Admin to manage Courts and associate Sponsors and Gallery content at Tournament level. |
| Primary Actor | Tournament Admin |
| Preconditions | Tournament in Draft or Setup (or otherwise allowed by rules) |
| Main Flow | Admin configures resources → system persists under Tournament ownership |
| Postconditions | Courts/Sponsors/Gallery available for dependent features |
| Acceptance Criteria | Courts remain Tournament-owned; Schedule can reference Courts without owning them |
| Priority | Must |

### TOUR-004 — Archive Tournament

| Field | Content |
| --- | --- |
| Title | Archive Tournament |
| Description | The system shall archive a Finished Tournament into a read-oriented historical state. |
| Primary Actor | Tournament Admin |
| Preconditions | Tournament is Finished |
| Main Flow | Admin archives → system transitions to Archived → competition edits blocked |
| Postconditions | Tournament is Archived; history retained |
| Acceptance Criteria | Scoring and structural regeneration are forbidden after Archive |
| Priority | Must |

---

## Category Module

### CAT-001 — Create Category

| Field | Content |
| --- | --- |
| Title | Create Category |
| Description | The system shall allow creation of Categories owned by a Tournament. |
| Primary Actor | Tournament Admin |
| Preconditions | Tournament exists; lifecycle allows creation |
| Main Flow | Admin creates Category configuration → Category owned by Tournament |
| Postconditions | Category available for Team registration |
| Acceptance Criteria | Category cannot exist outside Tournament |
| Priority | Must |

### CAT-002 — Modify Category Configuration

| Field | Content |
| --- | --- |
| Title | Modify Category configuration |
| Description | The system shall allow Category modification subject to Publish/Lock integrity rules. |
| Primary Actor | Tournament Admin |
| Preconditions | Category exists |
| Main Flow | Admin edits configuration → system enforces integrity constraints |
| Postconditions | Configuration updated or rejected with reason |
| Acceptance Criteria | Changes that invalidate Published/Locked artifacts are blocked unless exception path applies |
| Priority | Must |

### CAT-003 — Delete Category

| Field | Content |
| --- | --- |
| Title | Delete Category |
| Description | The system shall allow Category deletion only when no Published competition artifacts and no Verified Match history exist. |
| Primary Actor | Tournament Admin |
| Preconditions | Category eligible for deletion |
| Main Flow | Admin deletes → system validates → Category removed or rejection returned |
| Postconditions | Category removed only if rules allow |
| Acceptance Criteria | Category with Verified Matches cannot be deleted |
| Priority | Must |

### CAT-004 — Control Category Visibility

| Field | Content |
| --- | --- |
| Title | Control Category public visibility |
| Description | The system shall expose Category information to Public Viewer/TV Display only when Tournament and relevant artifacts are Published per rules. |
| Primary Actor | Public Viewer, TV Display |
| Preconditions | Required Publish states satisfied |
| Main Flow | Viewer requests Category info → system returns published information only |
| Postconditions | Unpublished competition details remain hidden |
| Acceptance Criteria | Draft/Setup unpublished details are not publicly visible |
| Priority | Must |

---

## Team Module

### TEAM-001 — Register Team

| Field | Content |
| --- | --- |
| Title | Register Team in Category |
| Description | The system shall register Teams into exactly one Category with Player composition. |
| Primary Actor | Tournament Admin |
| Preconditions | Category exists; registration window allowed |
| Main Flow | Admin registers Team and Players → validation → Team created |
| Postconditions | Team owned by Category |
| Acceptance Criteria | Team belongs to exactly one Category |
| Priority | Must |

### TEAM-002 — Validate Team Composition

| Field | Content |
| --- | --- |
| Title | Validate Team composition and eligibility |
| Description | The system shall validate Player composition against Category format before Drawing eligibility. |
| Primary Actor | System / Tournament Admin |
| Preconditions | Team exists |
| Main Flow | System validates composition → marks eligible/ineligible |
| Postconditions | Only eligible Teams participate in Drawing |
| Acceptance Criteria | Incomplete Teams are ineligible for Drawing |
| Priority | Must |

### TEAM-003 — Prevent Duplicates

| Field | Content |
| --- | --- |
| Title | Prevent duplicate Teams and Players |
| Description | The system shall prevent duplicate Team registration and duplicate Player assignment within the same Category. |
| Primary Actor | System |
| Preconditions | Registration attempt |
| Main Flow | System detects duplicate → rejects registration |
| Postconditions | Category remains free of duplicates |
| Acceptance Criteria | Duplicate Team/Player in same Category is rejected |
| Priority | Must |

### TEAM-004 — Withdraw or Replace

| Field | Content |
| --- | --- |
| Title | Handle withdrawal and replacement |
| Description | The system shall support Team withdrawal and Player replacement under Business Rules with audit. |
| Primary Actor | Tournament Admin |
| Preconditions | Team registered; action allowed by status rules |
| Main Flow | Admin withdraws/replaces → history preserved → dependent impacts flagged for Admin resolution |
| Postconditions | Eligibility updated; audit recorded |
| Acceptance Criteria | History is not silently deleted; withdrawn Teams cannot become Champion |
| Priority | Must |

---

## Drawing Module

### DRAW-001 — Generate Drawing

| Field | Content |
| --- | --- |
| Title | Generate Drawing via Tournament Engine |
| Description | The system shall invoke Tournament Engine Drawing generation for a Category with sufficient eligible Teams and Drawing Seed reproducibility. |
| Primary Actor | Tournament Admin |
| Preconditions | Eligible Teams sufficient; Tournament state allows Drawing |
| Main Flow | Admin requests generation → Engine produces Drawing version → Review required |
| Postconditions | Drawing candidate version exists; not Official until Publish |
| Acceptance Criteria | Engine does not auto-Publish; same inputs+seed reproducible |
| Priority | Must |

### DRAW-002 — Review Drawing

| Field | Content |
| --- | --- |
| Title | Review Drawing |
| Description | The system shall require Tournament Admin Review before Drawing Publish. |
| Primary Actor | Tournament Admin |
| Preconditions | Drawing candidate exists |
| Main Flow | Admin reviews → approve path or reject path |
| Postconditions | Approved Drawing eligible for Publish; rejection preserves history |
| Acceptance Criteria | Engine cannot approve Review; rejected Drawing can be edited/regenerated before new Review |
| Priority | Must |

### DRAW-003 — Publish Drawing

| Field | Content |
| --- | --- |
| Title | Publish Drawing |
| Description | The system shall Publish Drawing as Official version and make Drawing Seed immutable after Publish. |
| Primary Actor | Tournament Admin |
| Preconditions | Review completed for required artifact |
| Main Flow | Admin Publishes → Official version set → consumers may use official placements |
| Postconditions | One Official Drawing version; history retained |
| Acceptance Criteria | Seed cannot change after Publish; prior versions remain |
| Priority | Must |

### DRAW-004 — Replay Drawing

| Field | Content |
| --- | --- |
| Title | Replay Drawing |
| Description | The system shall support Drawing Replay as a new version without losing prior history, subject to Lock rules. |
| Primary Actor | Tournament Admin |
| Preconditions | Replay allowed (not Locked under normal operations) |
| Main Flow | Admin requests Replay → Engine creates new version → Review required |
| Postconditions | New version exists; old versions immutable |
| Acceptance Criteria | Replay after Lock is blocked unless Unlock exception applies |
| Priority | Must |

### DRAW-005 — Lock Drawing

| Field | Content |
| --- | --- |
| Title | Lock Drawing |
| Description | The system shall Lock Drawing to prevent unrestricted modification/Replay. |
| Primary Actor | Tournament Admin |
| Preconditions | Drawing exists; Admin authority |
| Main Flow | Admin Locks → unrestricted Replay/edits blocked |
| Postconditions | Drawing Locked |
| Acceptance Criteria | Unlock requires reason and audit |
| Priority | Must |

---

## Group Module

### GROUP-001 — Generate Groups

| Field | Content |
| --- | --- |
| Title | Generate Groups from Drawing |
| Description | The system shall generate Groups from Drawing placements via Tournament Engine. |
| Primary Actor | Tournament Admin |
| Preconditions | Drawing placements available |
| Main Flow | Generation requested → Groups created under Category |
| Postconditions | Groups exist for scheduling and standings context |
| Acceptance Criteria | Groups cannot be official before Drawing placements exist |
| Priority | Must |

### GROUP-002 — Protect Group Integrity

| Field | Content |
| --- | --- |
| Title | Protect Group structure after Lock/Verify |
| Description | The system shall prevent Group deletion/restructuring that violates Lock or Verified Match history rules. |
| Primary Actor | System / Tournament Admin |
| Preconditions | Groups exist |
| Main Flow | Structural change attempted → rules evaluated → allow/deny |
| Postconditions | Integrity preserved |
| Acceptance Criteria | Group with Verified Matches cannot be deleted |
| Priority | Must |

---

## Schedule Module

### SCH-001 — Generate Schedule

| Field | Content |
| --- | --- |
| Title | Generate Schedule |
| Description | The system shall generate Schedule via Tournament Engine using Groups/Matches and Tournament Courts by reference. |
| Primary Actor | Tournament Admin |
| Preconditions | Groups exist for group-stage schedule; Courts available as needed |
| Main Flow | Admin requests generation → Engine produces Schedule version → Review required |
| Postconditions | Schedule candidate exists; Courts remain Tournament-owned |
| Acceptance Criteria | Schedule never owns Courts; conflicts detected before Publish readiness |
| Priority | Must |

### SCH-002 — Detect Schedule Conflicts

| Field | Content |
| --- | --- |
| Title | Detect Court and Team conflicts |
| Description | The system shall detect Court conflicts and Team conflicts and block Publish of conflicting Schedule. |
| Primary Actor | System |
| Preconditions | Schedule candidate or adjustment exists |
| Main Flow | Validation runs → conflicts reported → Publish blocked if unresolved |
| Postconditions | Conflict report available to Admin |
| Acceptance Criteria | Conflicting Schedule cannot be Published |
| Priority | Must |

### SCH-003 — Manually Adjust Schedule

| Field | Content |
| --- | --- |
| Title | Manually adjust Schedule |
| Description | The system shall allow Tournament Admin to adjust timing/Court assignments before Lock, with conflict checks and audit. |
| Primary Actor | Tournament Admin |
| Preconditions | Schedule not Locked (or Unlock exception) |
| Main Flow | Admin adjusts → validation → save versioned/audited change |
| Postconditions | Schedule updated; conflicts prevented |
| Acceptance Criteria | Overlapping Court/Team assignments rejected |
| Priority | Must |

### SCH-004 — Publish and Lock Schedule

| Field | Content |
| --- | --- |
| Title | Publish and Lock Schedule |
| Description | The system shall support Schedule Publish for consumers and Lock to prevent unrestricted regeneration. |
| Primary Actor | Tournament Admin |
| Preconditions | Review complete; no conflicts |
| Main Flow | Publish and/or Lock per Admin action |
| Postconditions | Official Schedule consumable; Lock enforces integrity |
| Acceptance Criteria | Public Viewer/TV Display consume Published Schedule only |
| Priority | Must |

### SCH-005 — Regenerate and Reschedule

| Field | Content |
| --- | --- |
| Title | Regenerate Schedule and reschedule Matches |
| Description | The system shall support Schedule Regeneration and Match Rescheduled as versioned/audited actions under rules. |
| Primary Actor | Tournament Admin |
| Preconditions | Action allowed by Lock/state rules |
| Main Flow | Admin regenerates/reschedules → new version or audited change → Review/Publish as required |
| Postconditions | History preserved; Official version rules upheld |
| Acceptance Criteria | Regeneration does not silently delete prior Official history |
| Priority | Must |

---

## Match Module

### MATCH-001 — Create Matches from Schedule

| Field | Content |
| --- | --- |
| Title | Create Matches from Schedule |
| Description | The system shall create Matches through Schedule generation/adjustment inside Category ownership. |
| Primary Actor | System / Tournament Admin |
| Preconditions | Schedule process running |
| Main Flow | Schedule defines Matches → Matches exist in Waiting |
| Postconditions | Matches belong to Category; group or playoff structural placement set |
| Acceptance Criteria | Match cannot exist outside Category |
| Priority | Must |

### MATCH-002 — Assign Referee

| Field | Content |
| --- | --- |
| Title | Assign Referee to Match |
| Description | The system shall allow Referee assignment from Published onward. |
| Primary Actor | Tournament Admin |
| Preconditions | Tournament Published or later; Match exists |
| Main Flow | Admin assigns Referee → assignment recorded |
| Postconditions | Referee authorized for assigned Match operations |
| Acceptance Criteria | Assignment is auditable |
| Priority | Must |

### MATCH-003 — Progress Match Status

| Field | Content |
| --- | --- |
| Title | Progress Match Status |
| Description | The system shall enforce Match Status Waiting → Warm Up → Live → Finished → Verified. |
| Primary Actor | Referee / Tournament Admin |
| Preconditions | Tournament Live (or authorized exception); actor authorized |
| Main Flow | Status transition requested → rules validated → status updated → event recorded |
| Postconditions | Match in new status |
| Acceptance Criteria | Illegal transitions rejected; Verified cannot return to Waiting |
| Priority | Must |

### MATCH-004 — Submit Live Scores

| Field | Content |
| --- | --- |
| Title | Submit live scores |
| Description | The system shall allow authorized Referee or Tournament Admin override to submit scores only while Match is Live (and corrections per rules before Verified). |
| Primary Actor | Referee |
| Preconditions | Match Live; actor authorized |
| Main Flow | Score submitted → accepted → event/audit recorded |
| Postconditions | Live score state updated |
| Acceptance Criteria | Scoring denied in Waiting and after Verified under normal rules |
| Priority | Must |

### MATCH-005 — Verify Match Result

| Field | Content |
| --- | --- |
| Title | Verify Match result |
| Description | The system shall support Match verification as the official recorded outcome. |
| Primary Actor | Tournament Admin / Referee (if policy allows) |
| Preconditions | Match Finished with recorded result |
| Main Flow | Verify action → Match Verified → Standing update triggered |
| Postconditions | Official result established |
| Acceptance Criteria | Standings consume Verified results only |
| Priority | Must |

### MATCH-006 — Cancel or Abandon Match

| Field | Content |
| --- | --- |
| Title | Cancel or abandon Match |
| Description | The system shall support cancellation and abandonment with Admin resolution and audit. |
| Primary Actor | Tournament Admin |
| Preconditions | Exception condition |
| Main Flow | Admin cancels/abandons → outcome treatment recorded → dependent impacts require Admin resolution |
| Postconditions | Match not treated as normal verified win path unless Admin defines outcome |
| Acceptance Criteria | Action audited; history preserved |
| Priority | Must |

---

## Standing Module

### STAND-001 — Auto-Update Standings

| Field | Content |
| --- | --- |
| Title | Automatically update Standings |
| Description | The system shall update Standings when a Match becomes Verified. |
| Primary Actor | System |
| Preconditions | Match Verified |
| Main Flow | Verification completes → Standing Engine calculates → Standings updated |
| Postconditions | Standings reflect Verified results |
| Acceptance Criteria | Non-verified results do not update official Standings |
| Priority | Must |

### STAND-002 — Recalculate Standings

| Field | Content |
| --- | --- |
| Title | Recalculate Standings |
| Description | The system shall allow Tournament Admin to trigger Standing Recalculation for consistency restoration. |
| Primary Actor | Tournament Admin |
| Preconditions | Category has match/result context; Lock rules allow or Unlock applied |
| Main Flow | Admin triggers recalc → Engine recalculates → audit recorded |
| Postconditions | Standings consistency restored or ambiguity flagged |
| Acceptance Criteria | Tie-breaking ambiguity blocks Playoff generation until Admin resolves |
| Priority | Must |

### STAND-003 — Publish Standings

| Field | Content |
| --- | --- |
| Title | Publish Standings |
| Description | The system shall Publish Standings for Public Viewer and TV Display consumption. |
| Primary Actor | Tournament Admin |
| Preconditions | Standings available |
| Main Flow | Admin Publishes Standings → public consumers receive official Standings |
| Postconditions | Official Standings visible to allowed consumers |
| Acceptance Criteria | Unpublished Standings are not shown on Public Viewer/TV Display |
| Priority | Must |

---

## Playoff Module

### PLAY-001 — Generate Playoff and Bracket

| Field | Content |
| --- | --- |
| Title | Generate Playoff and Bracket |
| Description | The system shall generate Playoff and Bracket via Tournament Engine from qualification Standings. |
| Primary Actor | Tournament Admin |
| Preconditions | Qualification inputs complete; ambiguities resolved |
| Main Flow | Admin requests generation → Engine produces Playoff/Bracket versions → Review required |
| Postconditions | Reviewable Playoff/Bracket exist; not Official until Publish |
| Acceptance Criteria | Engine does not auto-Publish; Engine does not declare Champion |
| Priority | Must |

### PLAY-002 — Review and Publish Bracket

| Field | Content |
| --- | --- |
| Title | Review and Publish Bracket |
| Description | The system shall require Review before Playoff/Bracket Publish and expose Published Bracket to consumers. |
| Primary Actor | Tournament Admin |
| Preconditions | Generated Playoff/Bracket candidate |
| Main Flow | Review → Publish → Public Viewer/TV Display may consume |
| Postconditions | Official Bracket available |
| Acceptance Criteria | Publish without Review is rejected for required artifacts |
| Priority | Must |

### PLAY-003 — Advance Bracket from Verified Matches

| Field | Content |
| --- | --- |
| Title | Advance Bracket from Verified Matches |
| Description | The system shall update Bracket progression from Verified playoff Match outcomes according to Business Rules. |
| Primary Actor | System |
| Preconditions | Playoff Match Verified |
| Main Flow | Verification → progression update → consumers see updated official state per Publish rules |
| Postconditions | Bracket reflects verified advancement |
| Acceptance Criteria | Unverified playoff results do not advance official Bracket |
| Priority | Must |

### PLAY-004 — Declare Champion

| Field | Content |
| --- | --- |
| Title | Declare Champion |
| Description | The system shall declare Champion only after successful Playoff completion as a business outcome. |
| Primary Actor | Tournament Admin / System under rules |
| Preconditions | Playoff completed per Bracket outcomes |
| Main Flow | Completion detected/confirmed → Champion recorded → event/audit written |
| Postconditions | Champion exists for Category; supports Tournament Finished readiness |
| Acceptance Criteria | Champion cannot exist before Playoff completion; Engine never declares independently of rules |
| Priority | Must |

---

## Gallery Module

### GAL-001 — Manage Gallery

| Field | Content |
| --- | --- |
| Title | Manage Tournament Gallery |
| Description | The system shall allow Tournament Admin to manage Gallery content owned by Tournament. |
| Primary Actor | Tournament Admin |
| Preconditions | Tournament exists |
| Main Flow | Admin adds/updates/removes gallery content → content owned by Tournament |
| Postconditions | Gallery available for public presentation when visibility rules allow |
| Acceptance Criteria | Gallery remains Tournament-owned through Archive per retention rules |
| Priority | Should |

### GAL-002 — Present Gallery Publicly

| Field | Content |
| --- | --- |
| Title | Present Gallery to public consumers |
| Description | The system shall present published Gallery content to Public Viewer according to Tournament visibility rules. |
| Primary Actor | Public Viewer |
| Preconditions | Tournament/Gallery visibility allowed |
| Main Flow | Viewer requests gallery → published content returned |
| Postconditions | None |
| Acceptance Criteria | Non-visible gallery content is not exposed publicly |
| Priority | Should |

---

## Sponsor Module

### SPON-001 — Manage Sponsors

| Field | Content |
| --- | --- |
| Title | Manage Tournament Sponsors |
| Description | The system shall allow Tournament Admin to manage Sponsors owned by Tournament. |
| Primary Actor | Tournament Admin |
| Preconditions | Tournament exists |
| Main Flow | Admin maintains sponsor records → owned by Tournament |
| Postconditions | Sponsors available for presentation surfaces |
| Acceptance Criteria | Sponsors cannot exist outside Tournament ownership |
| Priority | Should |

### SPON-002 — Present Sponsors

| Field | Content |
| --- | --- |
| Title | Present Sponsors on public/TV surfaces |
| Description | The system shall present Sponsors on Public Viewer and TV Display according to visibility rules. |
| Primary Actor | Public Viewer, TV Display |
| Preconditions | Tournament published/visible as required |
| Main Flow | Consumer requests presentation → sponsor information included per rules |
| Postconditions | None |
| Acceptance Criteria | Sponsor presentation does not grant operational permissions |
| Priority | Should |

---

## Public Experience Module

### PUBX-001 — Public Viewer Access

| Field | Content |
| --- | --- |
| Title | Provide Public Viewer access |
| Description | The system shall provide Public Viewer access to published Schedule, Standings, Bracket, and related public tournament information without operational privileges. |
| Primary Actor | Public Viewer / Guest |
| Preconditions | Tournament/artifacts Published as required |
| Main Flow | Viewer opens public experience → published data displayed |
| Postconditions | None |
| Acceptance Criteria | Viewer cannot score, Publish, Lock, or modify competition structure |
| Priority | Must |

### PUBX-002 — TV Display Access

| Field | Content |
| --- | --- |
| Title | Provide TV Display access |
| Description | The system shall provide TV Display consumption of published/live presentation information for on-site screens. |
| Primary Actor | TV Display |
| Preconditions | Tournament Published/Live as applicable; artifacts published |
| Main Flow | Display requests presentation feed → published/live info returned |
| Postconditions | None |
| Acceptance Criteria | TV Display is not an administration interface |
| Priority | Must |

---

## Audit Module

### AUDIT-001 — Record Audit Log

| Field | Content |
| --- | --- |
| Title | Record Audit Log for significant actions |
| Description | The system shall record Audit Log entries for actions required by Business Rules (Publish, Lock/Unlock, Replay, score corrections, withdrawals, exceptions, etc.). |
| Primary Actor | System |
| Preconditions | Significant action occurs |
| Main Flow | Action committed → audit entry captured with minimum required fields |
| Postconditions | Audit entry retained with Tournament |
| Acceptance Criteria | Minimum fields include who, what, when, previous vs new official state, reason for exceptions |
| Priority | Must |

### AUDIT-002 — Record Event Log

| Field | Content |
| --- | --- |
| Title | Record Event Log domain occurrences |
| Description | The system shall record Event Log entries for meaningful domain events (Match Started, Standing Updated, Champion Declared, etc.). |
| Primary Actor | System |
| Preconditions | Domain event occurs |
| Main Flow | Event emitted → Event Log entry recorded |
| Postconditions | Chronological operational history available |
| Acceptance Criteria | Event Log complements Audit Log; retained through Archive retention |
| Priority | Must |

### AUDIT-003 — Inspect Logs

| Field | Content |
| --- | --- |
| Title | Inspect Audit and Event Logs |
| Description | The system shall allow authorized Admins to inspect Audit Log and Event Log for a Tournament. |
| Primary Actor | Tournament Admin / Super Admin |
| Preconditions | Logs exist; actor authorized |
| Main Flow | Admin inspects logs → entries displayed in business-readable form |
| Postconditions | None |
| Acceptance Criteria | Referee/Guest cannot access full administrative audit capabilities |
| Priority | Must |

---

## Export / Reporting Module

### RPT-001 — Export Tournament Records

| Field | Content |
| --- | --- |
| Title | Export tournament records |
| Description | The system shall allow Tournament Admin to export tournament records for Finished/Archived (and authorized earlier) states. |
| Primary Actor | Tournament Admin |
| Preconditions | Tournament has exportable official records |
| Main Flow | Admin requests export → system produces export of official records |
| Postconditions | Export available to Admin |
| Acceptance Criteria | Export reflects official/published/verified data, not discarded history |
| Priority | Should |

### RPT-002 — Future Read-Only API Consumer Readiness

| Field | Content |
| --- | --- |
| Title | Support future read-only integration needs |
| Description | The system shall structure published tournament information so future read-only API consumers can be supported without changing ownership or Business Rules. |
| Primary Actor | Future API Consumers |
| Preconditions | Published tournament information exists |
| Main Flow | N/A in V1 UI; readiness requirement for later contract design |
| Postconditions | No V1 public write integrations required |
| Acceptance Criteria | V1 does not require marketplace/payment integrations; read-only future path not blocked by ownership model |
| Priority | Could |

---

## Tournament Engine Integration Module

### ENG-001 — Invoke Engine Capabilities

| Field | Content |
| --- | --- |
| Title | Invoke Tournament Engine capabilities |
| Description | The system shall provide operator actions to invoke Drawing, Groups, Schedule, Standing calculation/recalculation, Playoff/Bracket generation, Validation, and Recommendations within Engine state awareness. |
| Primary Actor | Tournament Admin |
| Preconditions | Tournament/Category state allows capability |
| Main Flow | Admin invokes capability → Engine runs → candidate/output returned for Review where required |
| Postconditions | Versioned artifact or validation/recommendation result available |
| Acceptance Criteria | Engine never Publishes, Locks, approves Review, or owns entities |
| Priority | Must |

### ENG-002 — Surface Validation Failures

| Field | Content |
| --- | --- |
| Title | Surface Engine validation failures |
| Description | The system shall present Validation Engine failure detections to Tournament Admin without automatic fix. |
| Primary Actor | Tournament Admin |
| Preconditions | Validation failure detected |
| Main Flow | Failure detected → Admin informed → Admin resolves |
| Postconditions | Resolution owned by Admin |
| Acceptance Criteria | System does not auto-repair conflicts or insufficient teams |
| Priority | Must |

---

# Non Functional Requirements

### NFR-001 — Live Scoring Responsiveness

| Field | Content |
| --- | --- |
| Category | Performance |
| Description | Live score submissions and Match Status transitions shall be reflected to authorized operators and TV Display consumers quickly enough for on-court operations. |
| Acceptance Criteria | Under expected concurrent Live Matches for a single Tournament, score updates are available to operator/TV consumers without operationally blocking delays |
| Priority | Must |

### NFR-002 — Public Read Performance

| Field | Content |
| --- | --- |
| Category | Performance |
| Description | Public Viewer reads of published Schedule/Standings/Bracket shall remain responsive during Live tournaments. |
| Acceptance Criteria | Published read paths remain usable during peak viewing of a Live Tournament |
| Priority | Must |

### NFR-003 — Availability for Live Events

| Field | Content |
| --- | --- |
| Category | Availability |
| Description | The system shall be available for Live tournament operations during scheduled event windows. |
| Acceptance Criteria | Planned Live event windows have an availability target suitable for production sports operations; maintenance avoided during Live where possible |
| Priority | Must |

### NFR-004 — Horizontal Growth of Tournaments

| Field | Content |
| --- | --- |
| Category | Scalability |
| Description | The system shall support growth in number of Tournaments, Categories, Teams, and concurrent viewers without redesigning ownership boundaries. |
| Acceptance Criteria | Architecture remains modular around Tournament and Category aggregates as load grows |
| Priority | Should |

### NFR-005 — Reliable State Transitions

| Field | Content |
| --- | --- |
| Category | Reliability |
| Description | Tournament Lifecycle and Match Status transitions shall be reliable and reject illegal transitions consistently. |
| Acceptance Criteria | Illegal transitions never leave entities in undefined states |
| Priority | Must |

### NFR-006 — Secure Access Control

| Field | Content |
| --- | --- |
| Category | Security |
| Description | Operational actions shall require authenticated authorized roles; public surfaces shall expose only published information. |
| Acceptance Criteria | Unauthorized Publish/Lock/score attempts fail; secrets/credentials never exposed to clients inappropriately |
| Priority | Must |

### NFR-007 — Complete Auditability

| Field | Content |
| --- | --- |
| Category | Auditability |
| Description | Significant actions defined by Business Rules shall be auditable end-to-end. |
| Acceptance Criteria | For a completed Tournament, Publish/Lock/Replay/Verify/Champion actions are reconstructable from Audit/Event logs |
| Priority | Must |

### NFR-008 — Operator Usability Under Pressure

| Field | Content |
| --- | --- |
| Category | Usability |
| Description | Tournament Admin and Referee flows for Live operations shall be clear enough to operate under time pressure. |
| Acceptance Criteria | Core Live flows (Warm Up, Live scoring, Finish, Verify) are completable without spreadsheet workarounds |
| Priority | Must |

### NFR-009 — Accessibility Baseline

| Field | Content |
| --- | --- |
| Category | Accessibility |
| Description | Public Viewer and operator interfaces shall follow an accessibility baseline appropriate for web applications. |
| Acceptance Criteria | Critical public and operator screens support keyboard navigation and readable contrast as a baseline |
| Priority | Should |

### NFR-010 — Maintainable Modular Design

| Field | Content |
| --- | --- |
| Category | Maintainability |
| Description | Software modules shall follow Domain Model boundaries (Tournament, Category, Engine capability, Public Experience). |
| Acceptance Criteria | Feature changes in one Category competition area do not require redefining ownership |
| Priority | Must |

### NFR-011 — Operational Observability

| Field | Content |
| --- | --- |
| Category | Observability |
| Description | The system shall emit operational signals for failures in Engine generation, Live scoring, and auth denials sufficient for support diagnosis. |
| Acceptance Criteria | Support can identify failed generation/validation and Live scoring errors without reading source code |
| Priority | Should |

### NFR-012 — Environment Portability

| Field | Content |
| --- | --- |
| Category | Portability |
| Description | The system shall be deployable across standard modern hosting environments without changing business requirements. |
| Acceptance Criteria | Business behavior remains identical across environments |
| Priority | Should |

### NFR-013 — Localization Readiness

| Field | Content |
| --- | --- |
| Category | Localization |
| Description | User-facing text shall be externalizable for future localization; V1 may ship with a primary language. |
| Acceptance Criteria | UI copy is not hard-blocked from later localization |
| Priority | Could |

### NFR-014 — Backup and Recovery

| Field | Content |
| --- | --- |
| Category | Backup & Recovery |
| Description | Tournament data including Official versions, Audit Log, and Event Log shall be recoverable after infrastructure failure. |
| Acceptance Criteria | Recovery restores Official artifacts and audit history without silent loss |
| Priority | Must |

### NFR-015 — Data Retention

| Field | Content |
| --- | --- |
| Category | Data Retention |
| Description | Archived Tournaments, Official versions, Audit Log, and Event Log shall be retained per retention principles in Business Rules. |
| Acceptance Criteria | Replay/Regeneration never discards required historical versions/logs |
| Priority | Must |

### NFR-016 — Browser Compatibility

| Field | Content |
| --- | --- |
| Category | Compatibility |
| Description | Operator and Public Viewer experiences shall support current major evergreen browsers. |
| Acceptance Criteria | Core workflows function on current Chrome, Firefox, Safari, and Edge releases |
| Priority | Must |

### NFR-017 — Reproducible Drawing Guarantee

| Field | Content |
| --- | --- |
| Category | Reliability |
| Description | Drawing generation with identical inputs and Drawing Seed shall reproduce identical results. |
| Acceptance Criteria | QA can replay Drawing with stored seed/inputs and obtain the same placements |
| Priority | Must |

### NFR-018 — Concurrent Live Match Safety

| Field | Content |
| --- | --- |
| Category | Reliability |
| Description | Concurrent scoring on different Matches shall not corrupt Category Standings consistency. |
| Acceptance Criteria | Verified results applied produce coherent Standings without cross-match data loss |
| Priority | Must |

---

# User Roles

### Super Admin

Platform-level governance across Tournaments; exceptional governance actions with audit; not a substitute owner of Category competition artifacts.

### Tournament Admin

Owns day-to-day Tournament operation: configuration, Review, Publish, Lock/Unlock, Engine invocation, exception resolution, Champion/Finished/Archive path.

### Referee

Operates assigned Matches: Warm Up/Live/Finish transitions within authority, score submission, Verify only if policy allows.

### Public Viewer

Reads published tournament information; no operational control.

### TV Display

Reads published/live presentation information for venue screens; not an admin interface.

### Guest

Minimally privileged public access aligned with Public Viewer consumption of published information.

---

# Business Workflows

These are business workflows only (no UI flow).

1. **Create Tournament** — Authorized admin creates Tournament in Draft.
2. **Move Tournament to Setup** — Admin advances lifecycle; configures Categories, Courts, Sponsors, Gallery.
3. **Create Category** — Admin creates Category under Tournament.
4. **Register Teams** — Admin registers Teams/Players; system validates eligibility and duplicates.
5. **Generate Drawing** — Admin invokes Engine; Drawing version created; Review required.
6. **Review Drawing** — Admin approves or rejects; history preserved.
7. **Publish Drawing** — Admin Publishes Official Drawing; Seed immutable.
8. **Generate Groups** — Engine/groups structure created from Drawing.
9. **Generate Schedule** — Engine generates Schedule; conflicts validated; Review required.
10. **Publish Schedule** — Official Schedule available to operators/public/TV as allowed.
11. **Assign Referee** — Admin assigns Referee to Matches.
12. **Publish Tournament / Go Live** — Lifecycle moves to Published then Live when ready.
13. **Live Match** — Referee progresses Waiting → Warm Up → Live; submits scores; Finishes Match.
14. **Verify Match** — Authorized actor Verifies; Standing update runs.
15. **Standing Update / Recalculation** — Automatic on Verify; manual recalc when needed.
16. **Generate Playoff** — Engine generates Playoff/Bracket from qualification; Review required.
17. **Publish Bracket** — Official Bracket consumed by Public Viewer/TV Display.
18. **Declare Champion** — Champion recorded after Playoff completion.
19. **Finish Tournament** — Lifecycle to Finished when closure rules satisfied.
20. **Archive Tournament** — Lifecycle to Archived; read-only historical retention.

---

# System Constraints

- Business Rules are authoritative for behavior and authority.
- Domain Model is authoritative for ownership and aggregates.
- Tournament Engine never Publishes, Locks, approves Review, or owns entities.
- Review precedes Publish for required Engine-generated artifacts (Drawing, Schedule, Playoff).
- Publish creates Official version; Review alone does not.
- Lock protects integrity; Unlock is exceptional and audited.
- Only Verified Matches update official Standings.
- Published history is never deleted; versioning preserves immutability of older versions.
- Only one Official version per artifact family.
- Champion exists only after Playoff completion.
- Schedule references Courts; Schedule never owns Courts.
- Match remains inside Category aggregate consistency boundary.
- Audit is required for significant actions.
- V1 Archived Tournament is terminal for competition changes.

---

# Assumptions

- Event Organizers operate primarily through Tournament Admin role.
- Padel Category formats used in V1 have deterministic ranking criteria defined per Category configuration.
- Courts are known/configurable resources of the Tournament before Schedule Publish.
- Referees are assigned by Tournament Admin rather than self-serve marketplace matching.
- Public Viewer and TV Display consume read models of published/live data.
- A primary language is acceptable for V1 UI copy.
- Future read-only API consumers will follow the same Publish visibility rules.
- Network connectivity is generally available on-site; intermittent interruption is treated as an operational risk (see Risks).

---

# Dependencies

## Internal

- Product Glossary
- Business Domain Model
- Business Rules
- Tournament Engine Specification

## External

- Authentication Provider (identity for operational roles)
- File Storage (Gallery media and export artifacts)
- Hosting/runtime environment
- Future Live Streaming (optional later; not required for V1 core)
- Future read-only API consumers (post-V1 contract)

---

# Risks

| Risk | Business Impact | Mitigation Direction |
| --- | --- | --- |
| Large tournaments (many Categories/Matches) | Performance and operator overload | Scalability NFRs; Category aggregate boundaries; validation before Publish |
| Court conflicts | Unusable Schedule | Validation Engine; Publish blocked on conflicts |
| Human error in scoring | Incorrect Standings/Playoff | Verify step; audit; controlled correction/exception path |
| Network interruption during Live | Delayed scoring/display | Reliability/availability NFRs; clear operator recovery expectations |
| Score correction after Verify | Integrity disputes | Exception + Unlock policy; immutable history |
| Unexpected withdrawal | Schedule/Standing/Playoff inconsistency | Exception Rules; Admin-owned resolution |
| Tie-breaking ambiguity | Playoff blocked | Admin resolution required before generation |
| Engine output accepted without Review | Integrity failure | Mandatory Review requirements enforced by software |
| Unauthorized access | Data/competition integrity loss | Authentication and role enforcement |

---

# Success Criteria

- A Tournament can be operated from preparation to Champion declaration without spreadsheets as the system of record.
- Drawing is reproducible with Drawing Seed and retained history.
- Live scoring leads to Verified results that update Standings.
- Playoff/Bracket can be generated by Engine and Published after Review.
- Public Viewer and TV Display show official published information.
- Audit trail for Publish, Lock, Replay, Verify, and Champion is complete.
- Archived Tournaments remain historically readable.
- Tournament Engine never auto-Publishes or overrides Tournament Admin.

---

# Traceability Matrix

| Business Area / Rules | Tournament Engine Capability | SRS Modules / Requirements |
| --- | --- | --- |
| Tournament Lifecycle Rules | State awareness constraints | TOUR-001–004, AUTH-002 |
| Category Rules | Validation of Category config/state | CAT-001–004, ENG-002 |
| Team Rules | Validation (duplicates, missing players, insufficient teams) | TEAM-001–004, ENG-002 |
| Drawing / Review / Publish / Lock / Versioning Rules | Drawing Engine, Versioning | DRAW-001–005, ENG-001 |
| Group Rules | Group Generation Engine | GROUP-001–002 |
| Schedule Rules | Schedule Engine, Validation, Recommendation | SCH-001–005, ENG-001–002 |
| Match Rules / Referee Rules | (consumes Schedule; Engine does not score) | MATCH-001–006, AUTH-002 |
| Standing Rules | Standing Engine | STAND-001–003, ENG-001 |
| Playoff Rules / Champion | Playoff Engine | PLAY-001–004, ENG-001 |
| Publish / Review / Lock / Invariants | All generation capabilities constrained | DRAW/SCH/PLAY Review-Publish paths, System Constraints |
| Audit Rules | Engine audit responsibilities | AUDIT-001–003, ENG-001 |
| Public Experience | N/A (consumes outputs) | PUBX-001–002, GAL-002, SPON-002 |
| Gallery / Sponsors | N/A | GAL-001–002, SPON-001–002 |
| Export | N/A | RPT-001–002 |
| Exception Rules | Failure detection only | ENG-002, MATCH-006, TEAM-004 |

---

# Out of Scope

Explicitly not included in Set Point V1:

- QR Check-In
- Payment Gateway
- Marketplace
- Club Management
- Training Management
- Multi-Sport Support
- Native Mobile Applications
- AI-powered Tournament Assistant
- Auto Optimize Engine (Planned for V2)
- Quick Reschedule Suggestions (Planned for V2)
- Online public self-registration marketplace flows
- Push notification product
- Live streaming product integration (dependency placeholder only)
- Write-capable external partner APIs
- Detailed analytics product suite beyond Export
- Reopening Archived Tournaments into active competition

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Lead Software Architect | Initial Software Requirements Specification for Foundation Sprint |

---

*This SRS is the governing software requirements baseline for Set Point V1. Design and implementation artifacts (ERD, API, UI) must derive from this document without redefining Glossary terms, Domain ownership, Business Rules, or Tournament Engine boundaries.*
