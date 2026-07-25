# Product Glossary

| Field | Value |
| --- | --- |
| Document | Product Glossary |
| Product | Set Point |
| Version | 0.1.1 |
| Status | Foundation Sprint |
| Classification | Internal — Domain Language |
| Last Updated | 2026-07-25 |

---

## Purpose

This Product Glossary defines the official business vocabulary for Set Point.

It is the single source of truth for domain terminology. Every future document—including Business Rules, Software Requirement Specification, Tournament Engine Specification, Domain Model, ERD, API Specification, WebSocket Specification, UI/UX Design, database schema, frontend, backend, and supporting documentation—must use the terms defined here with the meanings given here.

Consistent language reduces ambiguity across product, design, and engineering and protects the integrity of the tournament domain.

---

## Usage Rules

1. Every official term in this glossary must be used consistently across product and engineering artifacts.
2. Do not introduce synonyms for defined terms. Prefer the glossary term even when informal language differs.
3. New business terms must be added to this glossary before they are used in other documents or implementations.
4. Database entities, APIs, UI labels, documentation, and code identifiers that represent business concepts must follow this glossary.
5. Definitions describe business meaning only. They do not prescribe technical implementation.
6. If a term’s meaning is unclear or disputed, resolve it here before proceeding in dependent documents.
7. Document responsibility boundaries:
   - **Product Glossary** defines terminology only.
   - **Business Rules** define behavior.
   - **Tournament Engine Specification** defines generation logic.

---

## Core Business Terms

### General

### Tournament

**Definition**

A Tournament is the highest-level container that organizes categories, schedules, matches, standings, playoffs, and final results for a single competitive padel event.

**Purpose**

Acts as the operational boundary for one Event Organizer-run competition from preparation through champion declaration and archive.

**Notes**

A Tournament progresses through official Tournament Lifecycle states. All primary operational artifacts belong to a Tournament. Lifecycle transition behavior is defined by Business Rules.

**Related Terms**

Category, Schedule, Playoff, Archive, Tournament Admin, Draft, Setup, Published, Live, Finished, Archived

---

### Category

**Definition**

A Category is a competitive division within a Tournament that groups teams or players under a shared set of competition rules and structure.

**Purpose**

Separates participants into distinct competitive tracks inside the same Tournament.

**Notes**

A Tournament may contain multiple Categories. Drawing, groups, schedule, standings, and playoffs are managed in the context of a Category unless otherwise specified by business rules.

**Related Terms**

Tournament, Team, Player, Group, Drawing, Standing, Playoff

---

### Team

**Definition**

A Team is a competing unit registered in a Category, composed of one or more Players according to the Category’s format.

**Purpose**

Represents the entity that enters draws, plays Matches, and accumulates results within a Category.

**Notes**

In padel formats that use pairs or fixed lineups, the Team—not the individual Player alone—is the primary competing unit.

**Related Terms**

Player, Category, Match, Drawing

---

### Player

**Definition**

A Player is an individual participant who may be assigned to a Team and compete in a Tournament Category.

**Purpose**

Identifies the people who participate in competition and appear in team composition and match participation.

**Related Terms**

Team, Category, Tournament

---

### Court

**Definition**

A Court is a playable venue resource within a Tournament where Matches can be scheduled and conducted.

**Purpose**

Provides the physical or logical location assignment used by scheduling and live operations.

**Notes**

Courts are tournament resources. Match scheduling assigns Matches to Courts according to availability and organizer decisions.

**Related Terms**

Match, Schedule, Live Match

---

### Tournament Structure

### Group

**Definition**

A Group is a subdivision of Teams within a Category used to organize round-robin or pool-stage competition before playoffs.

**Purpose**

Structures the preliminary stage of a Category so Teams can accumulate standings toward playoff qualification.

**Notes**

Groups are typically produced through Drawing and Group Generation. Each Group contains a set of Teams and the Matches among them.

**Related Terms**

Category, Team, Drawing, Match, Standing, Playoff

---

### Match

**Definition**

A Match is a scheduled contest between competing sides within a Category, producing a result that affects standings, progression, or championship outcome.

**Purpose**

Represents the atomic competitive event of the Tournament.

**Notes**

A Match progresses through official Match Status values. Status transition behavior is defined by Business Rules. Results feed Standings and Playoff progression.

**Related Terms**

Team, Court, Schedule, Live Match, Warm Up, Standing, Bracket, Waiting, Live, Finished, Verified

---

### Schedule

**Definition**

A Schedule is the ordered plan of Matches for a Tournament or Category, including timing and Court assignments.

**Purpose**

Coordinates when and where Matches are played during the event.

**Notes**

The Schedule is generated and remains editable under organizer control, consistent with Set Point design principles.

**Related Terms**

Match, Court, Publish, Live Match

---

### Standing

**Definition**

A Standing is the ranked competitive position of a Team within a Group or Category based on recorded Match results and ranking criteria.

**Purpose**

Communicates relative performance and supports qualification decisions for Playoffs.

**Notes**

The collection of Standings for a Group or Category is derived from completed Match results. Ranking rules are defined in Business Rules and Tournament Engine Specification.

**Related Terms**

Group, Match, Team, Playoff

---

### Playoff

**Definition**

A Playoff is the elimination or final-stage competition of a Category that follows the group or preliminary stage and leads to a Champion.

**Purpose**

Determines the Category winner through a structured post-group competition path.

**Notes**

Playoff structure is commonly represented as a Bracket. Entry into the Playoff is based on Standings and Category rules.

**Related Terms**

Bracket, Standing, Champion, Match, Category

---

### Bracket

**Definition**

A Bracket is the structured map of Playoff Matches showing progression paths from initial playoff slots to the final.

**Purpose**

Visualizes and governs how winners advance through the Playoff until a Champion is determined.

**Notes**

A Bracket is generated from qualification outcomes and remains subject to organizer review and edit under platform principles.

**Related Terms**

Playoff, Match, Champion, Drawing

---

### Champion

**Definition**

A Champion is the Team (or designated winning side) that wins the Playoff of a Category and is declared the Category winner.

**Purpose**

Marks the official competitive outcome of a Category.

**Notes**

Champion declaration is the culminating competitive result of the Category lifecycle.

**Related Terms**

Playoff, Bracket, Category, Tournament

---

### Tournament Operations

### Drawing

**Definition**

A Drawing is the process that assigns Teams into Groups (and related preliminary placements) for a Category according to drawing rules.

**Purpose**

Fairly and reproducibly establishes the initial competitive placement of Teams.

**Notes**

Drawing outputs are generated by the Tournament Engine, remain editable, and must be auditable and reproducible. Generation logic is defined by the Tournament Engine Specification; behavior is defined by Business Rules.

**Related Terms**

Drawing Seed, Drawing Replay, Group, Team, Category, Tournament Engine

---

### Drawing Seed

**Definition**

A Drawing Seed is the random seed value generated by the Tournament Engine to ensure that drawing results are reproducible.

**Purpose**

Enables the same Drawing inputs and Drawing Seed to produce the same drawing result, supporting replay, auditability, and fairness.

**Notes**

The same Drawing Seed produces the same drawing result. Drawing Seed exists for reproducibility, Drawing Replay, auditability, and fairness. It is not a team ranking and not a tournament seeding mechanism. Terminology only is defined here; generation logic belongs to the Tournament Engine Specification.

**Related Terms**

Drawing, Drawing Replay, Tournament Engine, Audit Log

---

### Drawing Replay

**Definition**

A Drawing Replay is the reproduction or regeneration of a Drawing using the Drawing Seed.

**Purpose**

Supports transparency and fairness by allowing organizers to reproduce a prior result or regenerate a Drawing under controlled conditions.

**Notes**

Every Drawing Replay must remain auditable. Previous drawing history must never be lost. Replay supports transparency and fairness. Behavior is defined by Business Rules; generation logic is defined by the Tournament Engine Specification.

**Related Terms**

Drawing, Drawing Seed, Lock, Audit Log, Event Log, Tournament Engine

---

### Publish

**Definition**

Publish is both a business action and a business state transition that makes a generated or revised tournament artifact the official version.

**Purpose**

Changes an artifact from internal preparation into the official version consumed by Tournament Admins, Referees, Public Viewer, and TV Display.

**Notes**

What may be Published (for example Schedule, Bracket, or Standings) is governed by Business Rules. Publish does not remove organizer ability to revise unless Lock applies. This glossary defines the term only; publication behavior is defined by Business Rules.

**Related Terms**

Review, Lock, Schedule, Public Viewer, TV Display, Tournament Admin, Referee, Published

---

### Review

**Definition**

Review is the organizer-controlled examination of generated tournament artifacts before they are accepted, published, or locked.

**Purpose**

Keeps humans in control by requiring deliberate confirmation of automated outputs.

**Related Terms**

Publish, Lock, Drawing, Schedule, Bracket

---

### Lock

**Definition**

Lock is a business state in which a tournament artifact or stage is protected against unrestricted modification once it enters an operational stage.

**Purpose**

Protects tournament integrity by preventing uncontrolled changes after an artifact becomes operationally binding.

**Notes**

Lock is not simply a UI action; it is a business state with integrity consequences. Exception handling is defined by Business Rules and must remain auditable. This glossary defines terminology only.

**Related Terms**

Publish, Review, Drawing, Archive, Audit Log

---

### Archive

**Definition**

Archive is the action that preserves a concluded Tournament in a read-oriented historical state.

**Purpose**

Retains official tournament records after the event without treating them as an active operations workspace.

**Notes**

Corresponds to the Tournament Archive capability in product scope and to the Tournament Lifecycle state Archived. Archived tournaments remain available for historical reference according to Business Rules.

**Related Terms**

Tournament, Audit Log, Event Log, Champion, Archived, Finished

---

### Live Match

**Definition**

A Live Match is a Match that is currently in progress and accepting official scoring updates.

**Purpose**

Identifies the active competitive state used for live scoring, standings updates, and real-time displays.

**Notes**

Corresponds to the Match Status value Live. Status behavior is defined by Business Rules.

**Related Terms**

Match, Warm Up, Standing, TV Display, Public Viewer, Referee, Live

---

### Warm Up

**Definition**

Warm Up is the pre-play period associated with a Match during which participants prepare on Court before official scoring begins.

**Purpose**

Distinguishes preparation time from Live Match scoring.

**Notes**

Warm Up is an official Match Status. It is an operational Match phase, not a separate competitive result. Status behavior is defined by Business Rules.

**Related Terms**

Match, Live Match, Court, Waiting, Live

---

### Roles

### Super Admin

**Definition**

A Super Admin is a platform-level role with authority across the Set Point system beyond a single Tournament.

**Purpose**

Supports platform administration and cross-tournament governance.

**Notes**

Super Admin authority is broader than Tournament Admin. Exact permissions are defined in Business Rules and access-control specifications.

**Related Terms**

Tournament Admin, Tournament Engine

---

### Tournament Admin

**Definition**

A Tournament Admin is an organizer role with authority to configure and operate a specific Tournament.

**Purpose**

Owns day-to-day tournament management decisions within the assigned Tournament boundary.

**Related Terms**

Tournament, Super Admin, Review, Publish, Lock, Drawing

---

### Referee

**Definition**

A Referee is an operational role authorized to manage scoring and match-control actions for assigned Matches.

**Purpose**

Supports accurate Live Match execution under Tournament rules.

**Related Terms**

Live Match, Match, Tournament Admin

---

### Guest

**Definition**

A Guest is an unauthenticated or minimally privileged viewer role with access limited to publicly available tournament information.

**Purpose**

Enables public consumption of published tournament information without granting operational control.

**Related Terms**

Public Viewer, Publish, Tournament

---

### Platform

### Tournament Engine

**Definition**

The Tournament Engine is the core business capability that generates and advances tournament structures and outcomes—such as draws, groups, schedules, standings, and playoff progression—according to defined rules.

**Purpose**

Provides intelligent automation for tournament operations while remaining subject to human review and control.

**Notes**

The Tournament Engine embodies “Automation First, Human Always in Control.” The Tournament Engine generates recommendations and tournament artifacts, but final approval always belongs to the Tournament Admin. Generation logic is defined by the Tournament Engine Specification; behavior is defined by Business Rules; this glossary defines terminology only.

**Related Terms**

Drawing, Drawing Seed, Group, Schedule, Standing, Playoff, Bracket, Tournament Admin, Review

---

### Audit Log

**Definition**

An Audit Log is the authoritative record of significant actions and changes performed in the platform for accountability and traceability.

**Purpose**

Makes tournament operations auditable by capturing who changed what and when at a business-meaningful level.

**Notes**

Audit Log focuses on accountability for controlled actions. It complements, but is distinct from, Event Log.

**Related Terms**

Event Log, Lock, Publish, Drawing Replay

---

### Event Log

**Definition**

An Event Log is the chronological record of meaningful tournament domain events that occur during preparation and live operations.

**Purpose**

Provides an operational timeline of what happened in the Tournament.

**Notes**

Event Log emphasizes domain occurrence history. Audit Log emphasizes accountability for actions and changes. Both support reproducibility and post-event review.

**Related Terms**

Audit Log, Live Match, Tournament, Archive

---

### TV Display

**Definition**

TV Display is the presentation surface for published tournament information intended for on-site screens during an event.

**Purpose**

Communicates schedules, live status, standings, and related public operational information to venue audiences.

**Notes**

TV Display consumes published and live tournament information; it is not an administration interface.

**Related Terms**

Public Viewer, Schedule, Standing, Live Match, Publish

---

### Public Viewer

**Definition**

Public Viewer is the public-facing experience for viewing published tournament information outside the organizer administration workspace.

**Purpose**

Allows Guests and external audiences to follow the Tournament without operational privileges.

**Related Terms**

Guest, TV Display, Publish, Schedule, Standing, Bracket

---

## Tournament Lifecycle

Official Tournament lifecycle states. Transition rules and allowed actions in each state are defined by Business Rules. This glossary defines terminology only.

### Draft

**Definition**

Draft is the Tournament Lifecycle state in which a Tournament exists as an initial, non-operational preparation record.

**Purpose**

Allows Tournament Admins to create and begin configuring a Tournament before it is ready for broader setup and publication.

**Notes**

Draft is the starting lifecycle state. Behavior and permitted transitions are defined by Business Rules.

**Related Terms**

Tournament, Setup, Tournament Admin

---

### Setup

**Definition**

Setup is the Tournament Lifecycle state in which a Tournament is being configured with categories, participants, resources, and generated artifacts prior to publication.

**Purpose**

Provides the working state for preparing the Tournament for official use.

**Notes**

During Setup, the Tournament Engine may generate recommendations and artifacts for Tournament Admin review. Final approval belongs to the Tournament Admin.

**Related Terms**

Tournament, Draft, Published, Drawing, Schedule, Review, Tournament Engine

---

### Published

**Definition**

Published is the Tournament Lifecycle state in which the Tournament’s official information is available for intended operational and viewing audiences.

**Purpose**

Marks the Tournament as officially released for consumption by Tournament Admins, Referees, Public Viewer, and TV Display according to Business Rules.

**Notes**

Published is distinct from the Publish action/state transition applied to individual artifacts, though both use the same business vocabulary family. Exact publication scope is defined by Business Rules.

**Related Terms**

Tournament, Publish, Setup, Live, Public Viewer, TV Display

---

### Live

**Definition**

Live is the Tournament Lifecycle state in which the Tournament is actively in progress and match operations are underway.

**Purpose**

Identifies that the event is running and operational scoring, scheduling, and display processes apply.

**Notes**

Do not confuse with Match Status Live. Tournament Live refers to the event as a whole; Match Status Live refers to an individual Match. Behavior is defined by Business Rules.

**Related Terms**

Tournament, Published, Finished, Live Match, Match

---

### Finished

**Definition**

Finished is the Tournament Lifecycle state in which competitive play for the Tournament has concluded, including champion declaration where applicable.

**Purpose**

Marks the end of active competition while retaining the Tournament for closure and archival preparation.

**Notes**

Do not confuse with Match Status Finished. Tournament Finished refers to the event as a whole. Behavior is defined by Business Rules.

**Related Terms**

Tournament, Live, Archived, Champion, Archive

---

### Archived

**Definition**

Archived is the Tournament Lifecycle state in which a concluded Tournament is preserved in a read-oriented historical state.

**Purpose**

Retains official tournament history after active operations have ended.

**Notes**

Corresponds to the Archive operation. Access and immutability rules are defined by Business Rules.

**Related Terms**

Tournament, Archive, Finished, Audit Log, Event Log

---

## Match Status

Official Match lifecycle states. Transition rules and scoring permissions in each status are defined by Business Rules. This glossary defines terminology only.

### Waiting

**Definition**

Waiting is the Match Status in which a Match is scheduled or queued but has not yet entered Warm Up or Live play.

**Purpose**

Indicates that the Match is not yet in an on-court operational phase.

**Notes**

Waiting precedes Warm Up. Scheduling and Court assignment may already exist. Behavior is defined by Business Rules.

**Related Terms**

Match, Schedule, Court, Warm Up, Live

---

### Warm Up

**Definition**

Warm Up is the Match Status in which participants are in the pre-play preparation period on Court before official scoring begins.

**Purpose**

Separates on-court preparation from official Live scoring.

**Notes**

Warm Up is not a competitive result state. Transition into Live is governed by Business Rules.

**Related Terms**

Match, Waiting, Live, Court, Live Match

---

### Live

**Definition**

Live is the Match Status in which a Match is in progress and official scoring updates are accepted.

**Purpose**

Identifies the active scoring state of a Match.

**Notes**

Corresponds to Live Match. Do not confuse with Tournament Lifecycle Live. Behavior is defined by Business Rules.

**Related Terms**

Match, Live Match, Warm Up, Finished, Referee

---

### Finished

**Definition**

Finished is the Match Status in which play has ended and a result exists, pending any required verification.

**Purpose**

Marks the end of active play for the Match.

**Notes**

Do not confuse with Tournament Lifecycle Finished. A Finished Match may still require transition to Verified according to Business Rules.

**Related Terms**

Match, Live, Verified, Standing

---

### Verified

**Definition**

Verified is the Match Status in which the Match result has been confirmed as the official recorded outcome.

**Purpose**

Establishes the authoritative Match result used for standings, progression, and official records.

**Notes**

Verification authority and exception handling are defined by Business Rules. This glossary defines terminology only.

**Related Terms**

Match, Finished, Standing, Playoff, Audit Log, Referee, Tournament Admin

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Lead Software Architect | Initial Product Glossary for Foundation Sprint |
| 0.1.1 | 2026-07-25 | Lead Software Architect | Architecture review: Drawing Seed/Replay, Publish, Lock, Tournament Engine, Lifecycle, Match Status |

---

*This glossary is the governing vocabulary for Set Point. New business terms must be added here before use in any other product or engineering artifact.*
