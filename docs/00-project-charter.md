# Set Point — Project Charter

| Field | Value |
| --- | --- |
| Document | Project Charter |
| Product | Set Point |
| Version | 0.1.1 |
| Status | Foundation Phase |
| Classification | Internal — Product Governance |
| Last Updated | 2026-07-25 |

---

## 1. Project Overview

**Set Point** is a production-grade Software-as-a-Service (SaaS) platform designed for Event Organizers who run padel tournaments.

The platform supports the full tournament lifecycle—from preparation through champion declaration—by combining intelligent automation with explicit human control. Automation accelerates operational work; organizers remain the final authority on decisions that affect competition integrity and participant experience.

The product is delivered as a dual-repository system:

| Repository | Responsibility |
| --- | --- |
| [FE-SetPoint](https://github.com/febrianrachmat/FE-SetPoint) | Client applications and organizer-facing experiences |
| [BE-SetPoint](https://github.com/febrianrachmat/BE-SetPoint) | Platform services, domain APIs, and backend capabilities |

---

## 2. Vision

To become the trusted operating system for padel tournament management—where Event Organizers can run professional competitions with confidence, speed, and full control.

---

## 3. Mission

Enable Event Organizers to prepare, operate, and conclude padel tournaments efficiently by providing a reliable SaaS platform that automates repetitive operational work while preserving human oversight at every critical decision point.

---

## 4. North Star

> Set Point enables Event Organizers to run professional padel tournaments from preparation to champion declaration through intelligent automation while keeping humans fully in control.

This statement is the product North Star. Every product and engineering decision—scope, design, automation behavior, and delivery priority—should align with it. If a proposal does not advance this outcome, it should be challenged or deferred.

---

## 5. Product Goals

1. **End-to-end tournament coverage** — Support Event Organizers from tournament preparation through champion declaration within a single coherent platform.
2. **Intelligent automation with human control** — Reduce manual operational burden through automation, while ensuring organizers retain authority over outcomes that matter.
3. **Operational reliability** — Deliver a production-grade experience suitable for live tournament environments where downtime and ambiguity are unacceptable.
4. **Scalable SaaS foundation** — Build a modular architecture that can grow with organizer volume, tournament complexity, and future product expansion without rework of core principles.
5. **Clear separation of concerns** — Maintain distinct frontend and backend repositories with well-defined ownership, interfaces, and delivery cadence.

---

## 6. Problem Statement

Event Organizers managing padel tournaments typically rely on fragmented tools, spreadsheets, and ad-hoc processes. This creates:

- High operational overhead during preparation and live play
- Inconsistent handling of tournament progression and results
- Increased risk of human error under time pressure
- Limited visibility and control when multiple people are involved
- Difficulty scaling from small events to larger, more complex tournaments

Set Point addresses this by providing a purpose-built SaaS platform that unifies tournament operations, applies intelligent automation where it creates leverage, and keeps organizers firmly in control.

---

## 7. Stakeholders

| Stakeholder | Role | Interest |
| --- | --- | --- |
| Event Organizers (primary users) | Plan and run padel tournaments | Reliable tools, speed, control, clear outcomes |
| Tournament staff / operators | Execute day-of operations | Usability under pressure, consistent workflows |
| Players / participants (indirect) | Compete in tournaments | Fair, timely, transparent tournament progression |
| Product Owner | Define product direction and priorities | Alignment of delivery with vision and mission |
| Engineering (Frontend / Backend) | Design and build the platform | Clear scope, stable foundations, maintainable architecture |
| Platform / DevOps | Reliability, environments, delivery | Operability, observability, secure deployment practices |
| Business / commercial stakeholders | Viability of the SaaS offering | Adoption, retention, and long-term product value |

---

## 8. Success Metrics

Success will be evaluated across product, operational, and delivery dimensions. Detailed KPIs will be refined as product discovery progresses; initial success signals include:

| Dimension | Indicator |
| --- | --- |
| Product adoption | Event Organizers can complete a tournament lifecycle using Set Point |
| Operational quality | Reduction in manual, error-prone steps during preparation and live operations |
| Control confidence | Organizers can intervene, override, or confirm automated actions when required |
| Platform reliability | Stable behavior under live-event conditions (availability and correctness) |
| Delivery health | Predictable foundation: documented charter, clear scope, dual-repo readiness |
| Maintainability | Modular structure that supports independent FE/BE evolution without coupling debt |

> Metrics in this charter are directional. Quantitative targets will be defined in subsequent product and engineering documentation.

---

## 9. Set Point Design Principles

1. **Automation First, Human Always in Control** — The platform should automate operational work by default, while ensuring Event Organizers retain final authority over decisions that affect competition integrity and outcomes.
2. **Everything is Generated** — Core tournament artifacts are produced by the system to reduce manual assembly and accelerate preparation.
3. **Everything is Editable** — Generated outputs remain fully adjustable so organizers can adapt to real-world constraints without leaving the platform.
4. **Everything is Auditable** — Meaningful actions and changes are traceable, supporting accountability during live operations and after the event.
5. **Everything is Reproducible** — Given the same inputs and rules, the platform should be able to recreate equivalent outcomes and tournament artifacts with confidence.
6. **Enterprise Simplicity** — Prefer clear, durable workflows and restrained complexity over clever abstractions that obscure operator understanding.

---

## 10. Development Principles

1. **Architecture before acceleration** — Establish foundations, boundaries, and documentation before application feature velocity.
2. **Modular and maintainable** — Prefer clear module boundaries, explicit contracts, and long-term readability.
3. **Enterprise engineering practices** — Code review, documentation discipline, environment hygiene, and change control are non-negotiable.
4. **FE / BE separation** — Frontend and backend evolve as coordinated but independently shippable systems.
5. **No speculative implementation** — Do not generate application modules, schemas, or endpoints ahead of approved design decisions.
6. **Documentation as a delivery artifact** — Charters, architecture, and operating docs are part of the product foundation, not afterthoughts.
7. **Scalability with restraint** — Design for growth without premature complexity.

---

## 11. Scope

Set Point Version 1 includes the following platform capabilities for Event Organizers managing padel tournaments:

- Tournament Management
- Category Management
- Team & Player Management
- Drawing
- Group Generation
- Match Scheduling
- Live Scoring
- Standings
- Playoff / Bracket
- TV Display
- Public Viewer
- Gallery
- Sponsors
- Export
- Audit Log
- Event Log
- Tournament Archive

---

## 12. Out of Scope

The following capabilities are intentionally excluded from Version 1:

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

These items may be reconsidered in future product versions based on product priorities and validated organizer needs.

---

## 13. Current Project Status

| Area | Status |
| --- | --- |
| Product concept | Defined at charter level |
| Repository structure | Dual repos initialized (FE / BE) |
| Project documentation | Charter created; further docs pending |
| Application codebase | Not started (intentionally) |
| Architecture specification | Pending next documentation phase |
| Delivery / CI foundations | Folder placeholders prepared; pipelines not yet defined |

**Phase:** Foundation Phase  
**Focus:** Project initialization, governance documents, and repository readiness  
**Constraint:** No application code generation during this phase

---

## 14. High-Level Roadmap

```text
Phase 0 — Product Discovery
✓ Completed

↓

Foundation Sprint
(Project Charter, Vision, Business Rules)

↓

Software Requirement Specification

↓

Tournament Engine Specification

↓

Domain Model

↓

ERD

↓

API Specification

↓

WebSocket Specification

↓

UI/UX Design

↓

Implementation

↓

Testing

↓

Production Release
```

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 0.1.0 | 2026-07-25 | Lead Software Architect | Initial project charter for Foundation Phase |
| 0.1.1 | 2026-07-25 | Lead Software Architect | Architecture review revisions: North Star, Design Principles, Scope, Out of Scope, Roadmap |

---

*This charter is the governing reference for Set Point project initialization. Subsequent documentation must remain consistent with the vision, mission, scope, and principles defined herein.*
