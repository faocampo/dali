# Dali

## What This Is

Dali is an open-source collaborative canvas for product and engineering teams, extending DJAI Open Canvas. It aims to replace existing visual-planning tools for product ideation, visual planning, mind mapping, mockups, and technical solution design, using Miro Business as a capability reference for the defined product workflows. It will run on operator-managed infrastructure, authenticate internal members through Okta, and eventually connect with Plane.

## Core Value

Product and engineering teams can collaboratively turn ideas into clear product and technical plans on a shared, editable canvas that supports their daily work well enough to replace Miro.

## Requirements

### Validated

- ✓ CAN-01: Infinite canvas with editable frames, sticky notes, formatted text, shapes, connectors, arrows, and freehand — Phase 1.
- ✓ CAN-02: Selection, movement, resizing, grouping, alignment, duplication, layering, and styling — Phase 1.
- ✓ IMG-01: Local reference-image import and arrangement, visual crop, live adjustments, and source-size restoration — Phase 1.
- ✓ IMG-02 / IMG-03: PNG export for whole boards, frames, and selected objects, with explicit resolution and background controls — Phase 1.
- ✓ MIND-01: Hierarchical mind maps with keyboard child/sibling creation and stable inline editing — Phase 2.
- ✓ MIND-02: Nested branch collapse/expand with retained descendants and history — Phase 2.
- ✓ MIND-03: Automatic measured layout as nodes and visibility change — Phase 2.
- ✓ MIND-04: Persistent topic typography and branch styling — Phase 2.

Evidence: [Phase 2 verification](phases/02-daily-mind-maps/02-VERIFICATION.md) (four requirements, corrective regressions and final user approval).

Evidence: [Phase 1 verification](phases/01-editable-canvas-and-image-portability/01-VERIFICATION.md) (regression results and user acceptance).

### Active

These are the agreed capabilities to scope into requirements and phases, rather than a commitment to deliver all capabilities in the first development phase.

#### Access and board library

- [ ] Internal team members sign in using operator-configured OIDC SSO with Okta compatibility.
- [ ] Each board has individual owner, editor, and viewer access settings.
- [ ] Owners manage board access, editors edit content, and viewers view content. Detailed permissions for facilitation and comments remain to be defined.
- [ ] A home view lists accessible boards and clearly distinguishes private and shared boards.
- [ ] Users create new boards and reopen persisted work across sessions.

#### Collaboration and facilitation

- [ ] Participants can edit a board together in real time with no product-enforced concurrent-user cap; validate with 20 simultaneous users on one canvas.
- [ ] Participants can follow a presenter's viewport using a Follow Me interaction.
- [ ] Users can attach persistent comments to specific canvas entities, using Miro's entity-anchored comments as an interaction reference.
- [ ] Facilitators can run a shared timer.
- [ ] Facilitators select eligible cards, invite participants into voting, assign configurable vote allowances per participant, and reveal results after voting.
- [ ] Teams can continue editing and discussing prioritized ideas after a vote.

#### Canvas and product design

- [ ] Expand the icon palette for product and technical diagrams. Core editable primitives shipped in Phase 1.
- [ ] Expanded diagram palettes support product flows, UML-style sequence diagrams, swimlanes, and C4-style system diagrams.
- [ ] Users create mockups on the canvas and discuss imported screenshots alongside them.
- [ ] Users create and reuse product-ideation and design-sprint templates with frames, notes, structured layouts, and images.
- [ ] Templates support customer-role maps, product-market-fit discovery, pains/gains, and assumptions/findings layouts.
- [ ] Users arrange reference diagrams, photos, and notes for presentation ideation on the canvas.

#### Mind maps

- [ ] MIND-05: Retain mind-map hierarchy and content through durable saving, reopening and concurrent editing — Phase 5.

#### Roadmaps and Gantt

- [ ] In the initial release, users compose roadmaps manually from ordinary canvas shapes, text, arrows, and icons, or start from a reusable roadmap template. Roadmap content uses the existing canvas object model.
- [ ] In the initial release, users add a Gantt widget that accepts tasks and start/end dates as input and renders the corresponding visual bars; task inputs are entered manually until later integrations.
- [ ] Gantt views show task rows against a navigable calendar axis, with labeled and colored bars.
- [ ] Roadmap and Gantt templates are available independently of project-management integrations.


### Deferred to Later Iterations

- MCP services for creating diagrams and mind maps from natural-language instructions; generated content must remain editable by the team when delivered.
- Plane integration for linking board cards/action items to tasks and sourcing task data for planning views.

### Out of Scope

- ClickUp imports — explicitly removed from scope by the user during project research.
- MCP creation in the initial release — explicitly deferred after project research.
- Plane integration in the initial iteration — explicitly deferred; the eventual target is linking board cards/action items to tasks and bringing task data into planning views.
- Editable migration of existing Miro boards in the initial iteration — users will start with new boards and exported reference images.
- Video-conferencing integrations — meetings continue in a separate conferencing application.
- Slide-presentation functionality — presentation ideation remains a canvas workflow.
- General spreadsheet-style tables — structured ideation layouts and date-driven Gantt tasks remain in scope.
- External guest access in the initial rollout — access is limited to signed-in internal members.
- General Miro feature parity — scope follows the team's diagramming and product-development workflows.

## Context

### Existing foundation

- Upstream source: DJAI Academy, [djai-open-canvas](https://github.com/DJAI-Academy/djai-open-canvas).
- The inspected upstream [README](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/README.md) (documented features and local storage model) describes browser-local boards, shapes, connectors, frames, sticky notes, text, images, object arrangement, starter templates, board backups, and PNG/PDF exports.
- The inspected upstream [package.json](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/package.json) (dependencies and verification commands) identifies React, TypeScript, Vite, and BlockSuite 0.22.4. This is a preliminary inspection, not an architecture or runtime validation.
- Upstream describes a client-only application. Shared persistence, identity, authorization, and real-time collaboration require design and implementation work.
- Dali's existing [LICENSE](../LICENSE) (repository license) is MIT. Upstream also declares MIT; preserve applicable attribution when incorporating source.
- The upstream source is incorporated with attribution. Phase 1 validates the local editing and image workflow; collaboration extension points remain for later phases.

### Daily workflows

1. **Product ideation:** Participants join a board while using separate video conferencing. A facilitator leads with Follow Me, works through customer needs and pains/gains templates, then runs design-sprint exercises with notes, frames, layout tables, and uploaded images. Participants vote on selected cards, review the results, and iterate on screens and product ideas. Plane task linkage is a later extension.
2. **Roadmap and product status:** A user assembles a visual roadmap with release goals, feature lists, colors, icons, arrows, and progress indicators, then complements it with a Gantt chart populated manually from tasks and dates. Task sourcing from Plane is deferred.
3. **Technical solution design:** Teams use sequence diagrams, swimlanes, system component libraries, and C4-style views to explain user interactions and technical architecture.
4. **Presentation ideation:** Users collect whiteboard photos, diagrams, reference images, and notes into a spatial workspace for developing and discussing a narrative.
5. **Mind mapping:** A daily-use workflow requires rapid keyboard-based node creation, branch expansion/collapse, and automatic layout.

### Public evidence boundary

Product requirements capture generic capabilities. Public documentation, examples, screenshots, fixtures, and test evidence use synthetic data. Operator-provided materials and deployment details remain outside the repository.

## Public Repository Boundary

Keep the repository and its entire publishable history organization-neutral. Never commit private organizational names or relationships, product information, customer data, screenshots, host paths, real identity-provider settings, deployment configuration, or operational evidence. Provide generic configuration interfaces and synthetic examples only. All real configuration and deployment settings are defined and maintained exclusively in operator-controlled infrastructure. This restriction applies to source, planning, documentation, fixtures, logs, PRs, and generated artifacts.

## Constraints

- **Deployment:** operator-managed infrastructure; hosting topology and operational requirements are still to be defined.
- **Identity:** Integrate with operator-configured OIDC SSO with Okta compatibility; protocol, application registration, and claims mapping remain to be determined.
- **Access:** Internal members only initially; enforce per-board owner/editor/viewer permissions.
- **Foundation:** Extend DJAI Open Canvas, preserving and validating useful existing capabilities.
- **Open source:** Maintain an open-source project with applicable upstream license notices.
- **Collaboration:** There is no product-enforced concurrent-user cap. Validate 20 concurrent users per canvas; this validation target is not an admission limit or evidence of unlimited infrastructure capacity. Representative board sizes and performance thresholds remain to be specified.
- **Language:** Project discussion and planning documents are in English. Product localization requirements are undecided.
- **Integration:** Plane is the future project-management target, deferred to a later iteration. ClickUp imports are excluded.
- **Schedule and budget:** No delivery deadline or infrastructure budget has been specified.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build Dali by extending DJAI Open Canvas | Reuse an existing single-user canvas foundation | Validated in Phase 1 |
| Use the defined product workflows to scope the Miro replacement | Prioritize daily diagramming and product-development needs | Confirmed direction |
| Deploy on operator-managed infrastructure with Okta SSO | Matches the requested internal deployment and identity model | Confirmed direction |
| Provide per-board owner/editor/viewer access and a board-library home | Support private and shared work with explicit access | Confirmed direction |
| Treat mind maps as an initial-scope priority | User identified them as very important for daily work | Validated in Phase 2 |
| Start with new boards and exported Miro images | User-selected initial migration approach | Confirmed direction |
| Defer MCP creation of editable diagrams and mind maps | User placed AI-agent creation after the initial release | Confirmed direction |
| Include roadmap composition and the Gantt widget in the initial release | User confirmed both are needed at launch | Confirmed direction |
| Build roadmaps from ordinary shapes and templates; implement Gantt as a task/date-driven widget | User clarified the distinct editing models | Confirmed direction |
| Defer Plane integration | User explicitly chose a later iteration | Confirmed direction |

### Execution preferences

- Execute automatically within approved plans; pause for blockers or consequential decisions.
- Deliver small phases focused on one capability at a time, with phases delivered sequentially.
- Parallel agents may perform independent work within an approved phase.
- Enable research before planning, plan checks before execution, and requirements verification after each phase.
- Use GPT-6-Astra for all agent tiers: heavy at xhigh, standard at medium, and light at low (the supported effort name for the user's requested "light").
- Keep generated pull-request descriptions to a concise change summary and validation results; omit optional PRD-style sections.

### Remaining design details

- Private-by-default new boards was proposed during discussion; confirm in access-control requirements.
- Research and requirements should resolve persistence/recovery, collaboration conflict behavior, shared versus personal collapse state, precise keyboard shortcuts, voting rules, comment permissions, board organization, MCP authorization and target-board selection, and supported export formats.
- Public synthetic examples will define template and editable-object acceptance criteria.

## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition:
1. Move invalidated requirements to Out of Scope with a reason.
2. Move verified, shipped requirements to Validated with a phase reference.
3. Add newly discovered requirements to Active.
4. Record significant decisions and their outcomes.
5. Update the product description if its behavior or scope changes.

After each milestone:
1. Review all sections.
2. Recheck the core value against team use.
3. Revisit exclusions and deferred capabilities.
4. Update context with actual usage and feedback.

---
*Last updated: 2026-09-15 after Phase 2 acceptance.*
