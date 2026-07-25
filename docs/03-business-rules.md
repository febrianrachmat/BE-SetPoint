# Business Rules

| Field | Value |
| --- | --- |
| Document | Business Rules |
| Product | Set Point |
| Version | 0.1.1 |
| Status | Foundation Sprint |
| Classification | Internal — Business Behavior |
| Last Updated | 2026-07-25 |
| Depends On | `00-project-charter.md`, `01-product-glossary.md`, `02-domain-model.md` |

---

## Purpose

This document defines **how the Set Point business behaves**.

It is the single source of truth for business behavior. Backend, frontend, Tournament Engine, QA, and API design must derive runtime behavior from these rules without inventing alternate business truth.

This document does **not** define UI flow, API endpoints, database design, algorithms, or technical architecture.

Document responsibility boundaries:

| Document | Responsibility |
| --- | --- |
| Product Glossary | Vocabulary |
| Business Domain Model | Structure, ownership, aggregates |
| **Business Rules** | **Behavior** |
| Tournament Engine Specification | Generation logic |

Terminology and ownership from the foundation documents are used as given and are not redefined here.

---

## Business Rule Principles

1. **Business first** — Rules describe padel tournament operations, not software mechanics.
2. **Technology independent** — Every rule remains true regardless of frontend, backend, database, or language.
3. **Human approval over automation** — The Tournament Engine may generate recommendations and artifacts; Tournament Admin retains final authority.
4. **Predictable state transitions** — Tournament Lifecycle and Match Status change only through allowed transitions.
5. **Immutable published history** — Once an artifact or history record is officially established, prior versions are not erased.
6. **Auditability** — Significant actions leave accountable records.
7. **Reproducibility** — Generated outcomes that depend on Drawing Seed must be reproducible from the same inputs and seed.
8. **Ownership consistency** — Behavior respects Aggregate Roots and ownership defined in the Domain Model.
9. **Enterprise simplicity** — Prefer clear, durable rules over clever exceptions.

---

# Tournament Lifecycle Rules

A Tournament progresses through: **Draft → Setup → Published → Live → Finished → Archived**.

Only Tournament Admin (within Tournament scope) or Super Admin (platform scope) may change Tournament Lifecycle state, subject to the rules below.

---

## Draft

**Purpose**

Create an initial, non-operational Tournament record.

**Business meaning**

The Tournament exists but is not ready for structured competition setup or public consumption.

**Allowed actions**

- Create Tournament
- Edit basic Tournament identity and configuration
- Add or remove Categories at a preparatory level
- Delete the Tournament if no irreversible operational history exists
- Move to Setup when minimum identity requirements are satisfied

**Forbidden actions**

- Publish Tournament or competition artifacts for operational/public use
- Generate Drawing, Groups, Schedule, or Playoff as official competition structure
- Start Live Matches
- Archive the Tournament as a completed event record

**Entry conditions**

- Tournament is newly created

**Exit conditions**

- Tournament Admin moves the Tournament to Setup after required identity/configuration is present

---

## Setup

**Purpose**

Configure Categories, Teams, Courts, Sponsors, Gallery, and generated competition artifacts before official release.

**Business meaning**

The Tournament is an active preparation workspace. Tournament Engine generation is allowed; human Review and approval remain mandatory.

**Allowed actions**

- Create, modify, and delete Categories (subject to Category Rules)
- Register and manage Teams and Players
- Configure Courts, Sponsors, and Gallery
- Generate Drawing, Groups, Schedule, Standings preview, and Playoff drafts via Tournament Engine
- Review, edit, Publish artifacts within preparation scope where allowed
- Lock artifacts when preparation requires integrity protection
- Move to Published when readiness rules are satisfied

**Forbidden actions**

- Operate Live Match scoring as an official live event
- Declare Champion as final Category outcome for a finished event
- Archive the Tournament

**Entry conditions**

- Tournament is in Draft and Tournament Admin advances it to Setup

**Exit conditions**

- Tournament Admin moves the Tournament to Published when Categories and required resources meet readiness rules

---

## Published

**Purpose**

Make the Tournament’s official information available to intended operational and viewing audiences.

**Business meaning**

The Tournament is officially released. Public Viewer and TV Display may consume published information. Competition may still be pending Live state.

**Allowed actions**

- View and operate against published artifacts
- Continue controlled preparation of unpublished Category details if Business Rules for that artifact allow
- Assign Referees
- Move to Live when the event is ready to begin Match operations
- Correct unpublished artifacts under Review rules

**Forbidden actions**

- Silently replace published history without audit
- Erase prior Drawing history
- Start Match scoring before Match Status rules allow
- Archive the Tournament

**Entry conditions**

- Tournament is in Setup
- Required Categories exist
- Tournament Admin executes Publish for the Tournament lifecycle transition

**Exit conditions**

- Tournament Admin moves the Tournament to Live when live operations are authorized to begin

---

## Live

**Purpose**

Conduct active tournament operations, including Match Status progression and scoring.

**Business meaning**

The event is in progress. Integrity, auditability, and controlled edits are mandatory.

**Allowed actions**

- Warm Up, Start, score, Finish, and Verify Matches
- Update Standings from Verified results
- Reschedule Matches under Schedule Rules
- Generate/review Playoff when qualification rules are met
- Declare Champion when Playoff completes
- Move to Finished when competition is complete

**Forbidden actions**

- Unrestricted structural rebuild that destroys published history
- Drawing changes that violate Lock/Publish rules
- Archive while competition is still active
- Engine auto-publishing without Tournament Admin approval

**Entry conditions**

- Tournament is Published
- Tournament Admin authorizes Live operations

**Exit conditions**

- All Categories requiring a Champion have a declared Champion, or Tournament Admin confirms competition closure under Exception Rules
- Tournament Admin moves the Tournament to Finished

---

## Finished

**Purpose**

Mark competitive play as concluded while retaining the Tournament for closure and archival preparation.

**Business meaning**

Competition is over. Results are official subject to correction/exception policy. The Tournament is not yet historical archive.

**Allowed actions**

- View official results
- Perform limited post-event corrections only under Exception Rules and Audit Rules
- Export tournament records
- Move to Archived

**Forbidden actions**

- Start new Live Matches as part of normal competition
- Regenerate Drawing/Groups/Playoff as if the event were still in Setup
- Treat the Tournament as an active preparation workspace

**Entry conditions**

- Tournament is Live
- Champion outcomes and Category closure satisfy Cross Rule Dependencies, or an approved exception is recorded

**Exit conditions**

- Tournament Admin archives the Tournament

---

## Archived

**Purpose**

Preserve the Tournament in a read-oriented historical state.

**Business meaning**

The Tournament is historical. It is no longer an active operations workspace.

**Allowed actions**

- View historical Tournament information
- Export historical records
- Inspect Audit Log and Event Log according to retention principles

**Forbidden actions**

- Structural competition edits
- New Drawing, Schedule regeneration for competition restart
- Live scoring
- Reopening as Draft/Setup without an explicit future policy (not defined for V1; V1 treats Archived as terminal)

**Entry conditions**

- Tournament is Finished
- Tournament Admin executes Archive

**Exit conditions**

- None in Set Point V1 (Archived is terminal)

---

# Category Rules

**CAT-01** A Category always belongs to exactly one Tournament.

**CAT-02** A Category may be created when the Tournament is in Draft or Setup. Creation during Published requires Tournament Admin authorization and must not break published competition integrity.

**CAT-03** Category competitive configuration may be modified freely in Draft/Setup before relevant artifacts are Published or Locked.

**CAT-04** After Drawing, Schedule, or Playoff for that Category is Published or Locked, Category structure changes that invalidate those artifacts are forbidden unless an Exception Rule applies and history is preserved.

**CAT-05** A Category may be deleted only if it has no Published competition artifacts and no Verified Match history. Otherwise it must be retained for integrity.

**CAT-06** Category archive follows Tournament Archive: Categories are preserved with the Tournament when the Tournament is Archived.

**CAT-07** Category visibility to Public Viewer and TV Display requires the Tournament to be at least Published and the relevant Category artifacts to be Published.

**CAT-08** Category owns Teams, Drawing, Groups, Matches, Schedule, Standings, and Playoff. Behavior must not move these ownerships to Tournament Engine or roles.

---

# Team Rules

**TEAM-01** A Team registers into exactly one Category.

**TEAM-02** Team registration is allowed in Draft/Setup, and in Published only before that Category’s Drawing is Locked/Published under Category Rules.

**TEAM-03** A Team must satisfy Category format validation (required Player composition) before it is eligible for Drawing.

**TEAM-04** Player composition must match the Category format. Incomplete Teams are ineligible for Drawing.

**TEAM-05** Duplicate Team registration in the same Category is forbidden. Duplicate Player assignment within the same Category is forbidden.

**TEAM-06** A Team may be removed before Drawing is Published/Locked. After that, removal is forbidden; Withdrawal rules apply instead.

**TEAM-07** Withdrawal after Drawing/Schedule existence must preserve history, trigger Exception Rules, and may require Schedule/Standing/Playoff impact handling under Tournament Admin control.

**TEAM-08** Player replacement is allowed only before the Team’s affected Match reaches Live, and only under Tournament Admin authorization with audit.

**TEAM-09** Eligibility for Matches requires the Team to be active (not withdrawn) and composed according to Category rules at Match start.

**TEAM-10** Withdrawn Teams do not advance in Playoff and do not become Champion.

---

# Drawing Rules

**DRAW-01** Drawing always belongs to exactly one Category.

**DRAW-02** Drawing requires a sufficient number of eligible Teams for the Category format. If insufficient, Drawing generation is forbidden and Exception Rules apply.

**DRAW-03** Drawing is a Generated Business Artifact produced by the Tournament Engine.

**DRAW-04** Drawing must be reproducible: the same inputs and Drawing Seed must produce the same result.

**DRAW-05** Drawing Seed is generated for reproducibility. Drawing Seed is not a team ranking and not a tournament seeding mechanism.

**DRAW-06** Drawing requires Tournament Admin Review before it can be Published.

**DRAW-07** Tournament Engine never Publishes Drawing automatically.

**DRAW-08** After Drawing is Published, Drawing Seed cannot change.

**DRAW-09** Drawing Replay creates a new Drawing version. Previous Drawing history must never be lost.

**DRAW-10** Drawing Replay is forbidden after Drawing is Locked, unless an Exception Rule explicitly authorizes a controlled unlock with full audit.

**DRAW-11** Lock on Drawing prevents unrestricted modification and further Replay under normal operations.

**DRAW-12** Published Drawing becomes the official group-placement artifact consumed by Groups and subsequent competition steps.

**DRAW-13** Manual edits to Drawing placements are allowed before Lock, require Tournament Admin authority, and must remain auditable. Edits after Publish must not erase history.

---

# Group Rules

**GRP-01** Groups belong to exactly one Category.

**GRP-02** Groups are created from Drawing outcomes (Group Generation). Groups do not exist as official structure before Drawing produces placements.

**GRP-03** Group membership may be adjusted only through controlled Drawing edit/Replay rules before Lock.

**GRP-04** Group deletion is forbidden after Matches in that Group are Verified, or after Drawing/Groups are Locked.

**GRP-05** Groups may be Published as part of official Category structure once Drawing is approved.

**GRP-06** Lock on Groups (or on Drawing that defines them) prevents unrestricted restructuring.

**GRP-07** Group-stage Matches belong structurally to their Group and consistently to the Category aggregate.

**GRP-08** Groups are the source context for group-stage Standings.

---

# Schedule Rules

**SCH-01** Schedule belongs to exactly one Category.

**SCH-02** Schedule generation requires Groups (for group stage) and available Tournament Courts.

**SCH-03** Schedule owns scheduling decisions. Schedule references Courts; Schedule never owns Courts.

**SCH-04** A Match may reference at most one Court at a time.

**SCH-05** Schedule must prevent Court conflicts: the same Court cannot be assigned to overlapping Matches.

**SCH-06** Schedule must prevent Team conflicts: the same Team cannot be assigned to overlapping Matches.

**SCH-07** Schedule is generated by the Tournament Engine as a recommendation/artifact and requires Tournament Admin Review before Publish.

**SCH-08** Manual adjustment of time/Court is allowed before Lock, under conflict-prevention rules, with audit.

**SCH-09** Schedule Regeneration creates a new Schedule version or controlled replacement under Review rules; prior published Schedule history must remain auditable.

**SCH-10** Match Rescheduled is allowed in Live under Tournament Admin authority if conflicts remain resolved and audit is recorded.

**SCH-11** After Schedule Lock, unrestricted regeneration is forbidden; exceptions require Unlock policy.

**SCH-12** Published Schedule is consumable by Tournament Admins, Referees, Public Viewer, and TV Display.

---

# Match Rules

**MATCH-01** A Match belongs to exactly one Category and cannot exist outside that Category.

**MATCH-02** A Match is created through Schedule generation or controlled Schedule adjustment; ad-hoc Matches outside Schedule process are forbidden in normal operations.

**MATCH-03** Official Match Status order is: Waiting → Warm Up → Live → Finished → Verified.

**MATCH-04** Waiting means the Match is scheduled/queued and not yet in on-court Warm Up or Live play.

**MATCH-05** Warm Up may begin only when the Tournament is Live (or explicitly authorized for operational rehearsal under Tournament Admin exception) and Court/Team readiness rules are satisfied.

**MATCH-06** A Match may Start (enter Live) only from Warm Up, unless Tournament Admin authorizes a controlled exception with audit.

**MATCH-07** While Live, authorized Referee (or Tournament Admin override) may submit scores.

**MATCH-08** Score submission is forbidden in Waiting and after Verified, except correction under Exception Rules.

**MATCH-09** A Match may Finish only from Live when play has ended and a result is recorded.

**MATCH-10** Verification confirms the result as the official recorded outcome. Only Tournament Admin, or Referee where authorized by Category/Tournament policy, may Verify.

**MATCH-11** Standing updates use Verified results only.

**MATCH-12** Corrections after Finished but before Verified are allowed by authorized roles with audit.

**MATCH-13** Corrections after Verified are forbidden unless Exception Rules and Unlock/correction policy apply; history must be preserved.

**MATCH-14** Cancellation marks a Match as not played under official result rules defined by Tournament Admin decision and Exception Rules; cancellation must be audited.

**MATCH-15** Abandonment applies when a Match starts but cannot complete; Tournament Admin determines official outcome treatment under Exception Rules with audit.

**MATCH-16** Court reassignment is a Schedule decision and must obey conflict-prevention rules.

**MATCH-17** Referee assignment may occur from Published onward; a Live Match should have an assigned Referee unless Tournament Admin explicitly operates scoring.

**MATCH-18** Cancelled or abandoned Matches cannot produce a Champion by themselves; progression impact follows Standing/Playoff Rules.

---

# Standing Rules

**STD-01** Standings belong to the Category and reflect Team performance from Verified Match results.

**STD-02** Standings update automatically when a Match becomes Verified.

**STD-03** Manual Standing recalculation may be triggered by Tournament Admin when results/corrections require consistency restoration.

**STD-04** Tie-break resolution must follow the Category’s defined ranking criteria. This document does not define the calculation algorithm; it requires that a deterministic business criterion exists per Category.

**STD-05** If tie-break criteria cannot resolve ranking needed for qualification, Tournament Admin must resolve under Exception Rules with audit before Playoff generation proceeds.

**STD-06** Qualification for Playoff is derived from Standings according to Category rules.

**STD-07** Standings may be Published for Public Viewer and TV Display.

**STD-08** After Standing Lock (when applied), unrestricted recalculation is forbidden except under Unlock/exception policy.

**STD-09** Standings used for Playoff generation must be based on Verified results only.

---

# Playoff Rules

**PO-01** Playoff belongs to exactly one Category.

**PO-02** Playoff generation requires completed qualification inputs from Standings (and any required group-stage completion rules).

**PO-03** Tournament Engine generates Playoff and Bracket as recommendations/artifacts.

**PO-04** Tournament Admin must Review and approve Playoff before Publish.

**PO-05** Engine never Publishes Playoff or Bracket automatically.

**PO-06** Manual review may adjust Bracket placements only before Lock and only with audit, without violating qualification eligibility.

**PO-07** Bracket updates during Live Playoff (advancement) follow Match Verified outcomes.

**PO-08** Champion is declared only after Playoff completes successfully according to Bracket outcomes.

**PO-09** Champion is a business outcome derived from Playoff; it has no independent lifecycle.

**PO-10** Without a declared Champion (when the Category requires one), Tournament cannot move to Finished under normal rules.

**PO-11** Published Bracket is consumable by Public Viewer and TV Display.

**PO-12** Lock on Playoff/Bracket prevents unrestricted structural regeneration.

---

# Review Rules

Review is a formal business concept. It is the Tournament Admin examination of generated tournament artifacts before they are accepted for Publish.

**REV-01** Engine-generated artifacts requiring Review:
- Drawing
- Schedule
- Playoff

**REV-02** Review is mandatory before Publish for required artifacts.

**REV-03** Review does not make an artifact official. Only Publish creates the official version.

**REV-04** Review does not change ownership. Artifacts remain owned by their Aggregate.

**REV-05** Rejected Review preserves history. Rejected artifacts may be regenerated or edited before another Review.

**REV-06** Tournament Engine cannot approve Review. Only Tournament Admin performs Review.

---

# Publish Rules

**PUB-01** Publish is both a business action and a business state transition that makes an artifact the official version for intended audiences.

**PUB-02** Who may Publish: Tournament Admin for Tournament-scoped artifacts; Super Admin only for platform-level governance actions, not as a substitute for Category competition ownership.

**PUB-03** Publish is allowed when the artifact is complete enough for official use and has passed Review where required.

**PUB-04** Publish is forbidden when required prerequisites are missing (see Cross Rule Dependencies), when the artifact is in conflict state, or when the Tournament is Archived.

**PUB-05** Tournament Engine must never Publish automatically.

**PUB-06** After Publish, the official version is what Tournament Admins, Referees, Public Viewer, and TV Display consume.

**PUB-07** After Publish, prior versions/history must remain auditable; silent overwrite without history is forbidden.

**PUB-08** Publish does not by itself equal Lock. Further edits may remain possible until Lock, subject to artifact-specific rules.

**PUB-09** What becomes immutable after Publish depends on artifact type:
- Drawing Seed becomes immutable after Drawing Publish
- Published history records are immutable
- Competitive outcomes already Verified remain immutable under normal operations

**PUB-10** Tournament Lifecycle Published means the Tournament is officially released; artifact-level Publish may still apply to Drawing, Schedule, Standings, and Bracket individually.

---

# Lock Rules

**LOCK-01** Lock is a business state that protects tournament integrity by preventing unrestricted modification once an artifact/stage is operationally binding.

**LOCK-02** Lock is not merely a UI action.

**LOCK-03** Who may Lock: Tournament Admin. Super Admin may Lock only under platform governance exceptional authority with audit.

**LOCK-04** Effects of Lock:
- Unrestricted edits forbidden
- Drawing Replay forbidden under normal operations
- Schedule Regeneration forbidden under normal operations
- Structural Group/Playoff rebuild forbidden under normal operations

**LOCK-05** Lock does not erase history and does not remove Audit/Event Log obligations.

**LOCK-06** Exceptions to Locked constraints require explicit Exception Rules handling and audit.

**LOCK-07** Unlock policy (V1):
- Unlock is exceptional, not routine
- Only Tournament Admin may Unlock, with mandatory reason and audit
- Unlock does not delete prior Locked/Published history
- After corrective action, re-Lock is expected before continuing Live integrity-sensitive operations

**LOCK-08** Archived Tournaments are treated as comprehensively locked for competition changes.

---

# Versioning Rules

These rules define common version behavior for all generated artifacts.

**VER-01** Regeneration creates a new version.

**VER-02** Older versions remain immutable.

**VER-03** Only one version may be Official.

**VER-04** Version history is auditable.

**VER-05** Versioning never changes ownership.

**VER-06** Replay and Regeneration are forms of version creation.

---

# Tournament Engine Rules

**ENG-01** Tournament Engine generates recommendations and tournament artifacts (Drawing, Groups, Schedule, Standings calculations, Playoff/Bracket).

**ENG-02** Tournament Engine never Publishes automatically.

**ENG-03** Tournament Engine never Locks automatically as a substitute for Tournament Admin decision.

**ENG-04** Tournament Engine never overrides Tournament Admin decisions.

**ENG-05** Final approval always belongs to Tournament Admin.

**ENG-06** Engine always records generated artifacts within Category/Tournament ownership boundaries.

**ENG-07** Engine preserves reproducibility for Drawing through Drawing Seed.

**ENG-08** Engine must support Drawing Replay and Schedule Regeneration as versioned/auditable regenerations, not silent replacements.

**ENG-09** Engine output remains editable by Tournament Admin until Lock rules forbid edits.

**ENG-10** Generation logic details belong to Tournament Engine Specification; this document constrains business authority and outcomes only.

---

# Referee Rules

**REF-01** Referee may score assigned Matches when Match Status is Live.

**REF-02** Referee may transition assigned Matches through Warm Up → Live → Finished according to Match Rules and assignment scope.

**REF-03** Referee may Verify a Match only when Tournament policy grants Referee verification authority; otherwise Tournament Admin verifies.

**REF-04** Referee may not Publish Tournament Lifecycle state, Drawing, Schedule, Standings, or Playoff.

**REF-05** Referee may not Lock or Unlock Category artifacts.

**REF-06** Referee may not alter Drawing, Groups, or Bracket structure.

**REF-07** Referee edits to scores are allowed during Live and before Verified; after Verified, edits are prohibited unless Tournament Admin exception applies.

**REF-08** Guest has no scoring, verification, or edit authority.

**REF-09** Tournament Admin may override Referee scoring/verification with audit when integrity requires it.

---

# Audit Rules

**AUD-01** The following require Audit Log records at minimum:
- Tournament Lifecycle transitions
- Publish and Lock/Unlock actions
- Drawing generation, Replay, Publish, Lock
- Schedule generation, regeneration, Publish, Lock, Match Rescheduled
- Referee assignment
- Score submission and score corrections
- Match Verify, Cancel, Abandon
- Standing recalculation
- Playoff generation/approval/Publish
- Champion declaration
- Team withdrawal/replacement
- Exception resolutions by Tournament Admin

**AUD-02** Minimum audit information:
- Who performed the action
- What business entity/artifact was affected
- What action occurred
- When it occurred
- Previous official state vs new official state (business-meaningful)
- Reason when the action is exceptional (Unlock, correction, abandonment, withdrawal)

**AUD-03** Event Log records meaningful domain occurrences (for example Match Started, Standing Updated, Champion Declared) complementary to Audit Log accountability.

**AUD-04** Retention principle: Audit Log and Event Log remain available at least through Tournament Archived retention and are not discarded by regeneration or Replay.

**AUD-05** Business importance: Auditability sustains fairness, dispute resolution, reproducibility confidence, and enterprise accountability.

---

# Exception Rules

Exceptions do not invent alternate product features. They define business expectations when normal flow cannot proceed.

**EX-01 Insufficient Teams**  
Drawing and dependent Group/Schedule/Playoff generation are blocked until eligibility counts are satisfied or Tournament Admin changes Category configuration.

**EX-02 Court unavailable**  
Schedule must not assign the Court to overlapping Matches. Tournament Admin must reassign Court or reschedule affected Matches.

**EX-03 Match cancelled**  
Match does not produce a normal Verified competitive result unless Tournament Admin defines an official outcome under policy; Standing/Playoff impact requires explicit Admin resolution with audit.

**EX-04 Schedule conflict**  
Conflicting Schedule cannot be Published. Conflicts must be resolved before Publish/Lock.

**EX-05 Player withdrawal / Team withdrawal**  
History preserved. Eligibility updates immediately. Schedule/Standing/Playoff impacts require Tournament Admin resolution; silent deletion of history is forbidden.

**EX-06 Referee unavailable**  
Tournament Admin may reassign Referee or operate scoring override with audit. Live Match must not proceed without accountable scoring authority.

**EX-07 Unexpected interruption**  
If a Live Match is interrupted, status may move to abandonment/cancellation handling under Tournament Admin decision with audit before Standings consume an official outcome.

**EX-08 Tie-breaking ambiguity**  
Playoff generation is blocked until Tournament Admin applies Category tie-break policy or records an explicit resolution with audit.

**EX-09 Locked artifact requires correction**  
Use Unlock policy, correct with audit, then re-Lock. Do not rewrite history silently.

---

# Business Invariants

Business Invariants are permanent truths that must never be violated. They are not workflows.

- Tournament owns Categories.
- Category owns Matches.
- Team belongs to exactly one Category.
- Match belongs to exactly one Category.
- Verified Match cannot return to Waiting.
- Published history is never deleted.
- Locked artifacts require Unlock before modification.
- Champion exists only after Playoff completion.
- Tournament Engine never owns business entities.
- Review never changes ownership.
- Publish never bypasses Review where Review is required.

---

# Cross Rule Dependencies

These dependencies are mandatory under normal operations:

1. **Tournament must exist before Category.**
2. **Category must exist before Team registration.**
3. **Eligible Teams must exist before Drawing.**
4. **Drawing must exist before official Groups.**
5. **Groups must exist before group-stage Schedule.**
6. **Schedule must exist before Match operations.**
7. **Match must be Verified before Standing update from that Match.**
8. **Required Standings/qualification must exist before Playoff generation.**
9. **Playoff must complete before Champion declaration.**
10. **Required Champions / Category closure before Tournament Finished.**
11. **Tournament Finished before Archived.**
12. **Review before Publish for Engine-generated competition artifacts.**
13. **Publish does not replace Lock where integrity requires Lock.**
14. **Court ownership remains on Tournament whenever Schedule references Courts.**

---

# Rule Summary Matrix

| Business Area | Primary Rule | Depends On | Produces | Consumed By |
| --- | --- | --- | --- | --- |
| Tournament Lifecycle | Predictable Draft→Archived transitions | Tournament Admin authority | Official Tournament state | All domains |
| Category | Category owned by Tournament; competition boundary | Tournament in Draft/Setup/Published | Competition container | Teams, Drawing, Schedule, Playoff |
| Team | Valid composition and eligibility | Category format | Eligible Teams | Drawing, Matches, Standings |
| Drawing | Generated, reviewable, reproducible artifact | Eligible Teams, Tournament Engine | Official placements + Drawing Seed | Groups |
| Group | Created from Drawing; owns group-stage Matches | Published/approved Drawing | Group structure | Schedule, Standings |
| Schedule | Owns scheduling decisions; references Courts | Groups, Tournament Courts | Match timing/Court plan | Match Ops, Public Viewer, TV Display |
| Match | Status Waiting→Verified; Verified is official | Schedule, roles | Official results | Standings, Playoff |
| Standing | Updates from Verified Matches only | Verified Matches | Rankings/qualification | Playoff |
| Playoff | Generated from qualification; Admin approval | Standings | Bracket, Champion outcome | Public Viewer, Tournament Finished |
| Publish | Admin action/state transition; never by Engine | Review completeness | Official consumable artifacts | Admins, Referees, Public Viewer, TV Display |
| Lock | Business integrity state | Tournament Admin | Protected artifacts | Live Operations, Archive |
| Tournament Engine | Generate only; never auto-publish/override | Business inputs | Recommendations/artifacts | Tournament Admin Review |
| Referee | Score/operate assigned Live Matches | Assignment, Match Status | Score inputs, possible Verify | Match, Standings |
| Audit | Significant actions recorded | All controlled actions | Audit Log / Event Log | Governance, disputes, Archive |
| Exceptions | Controlled deviation with audit | Failed normal preconditions | Resolved continuation or blocked state | Admin decision path |

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Lead Software Architect | Initial Business Rules for Foundation Sprint |
| 0.1.1 | 2026-07-25 | Lead Software Architect | Final polish: Review Rules, Versioning Rules, Business Invariants |

---

*This Business Rules document is the governing source of business behavior for Set Point. Implementation and generation specifications must conform to these rules without redefining vocabulary or ownership.*
