# Roadmap: Dali

**Status:** Approved by the user.
**Milestone:** v1 initial release
**Project mode:** mvp
**Granularity:** fine
**Phase ID convention:** sequential

## Overview

Dali will deliver the approved canvas workflows through small sequential phases, each with an end-to-end capability that can be demonstrated. Core canvas editing and image portability come first, followed immediately by daily mind maps. Authenticated board access, durable recovery, and real-time collaboration establish shared use before facilitation, reusable planning content, mockups, technical diagrams, and the Gantt widget complete the initial release.

All 42 v1 requirements are approved; the phase allocation and order below are user-approved. Phases 1 and 2 retain their recorded implementation evidence and user acceptance. Remaining phase success criteria are future acceptance obligations.

## Phases

**Phase Numbering:** Integer phases are planned milestone work. Decimal phases are reserved for later insertions and execute between the surrounding integers.

- [x] **Phase 1: Editable Canvas and Image Portability** - Compose boards, import reference images, and export board content or selected shapes. (completed 2026-09-12)
- [x] **Phase 2: Daily Mind Maps** - Create styled hierarchical mind maps with keyboard input, branch collapse, and automatic layout. (completed 2026-09-15)
- [ ] **Phase 3: Okta and Board Access** - Sign in, discover authorized boards, and manage owner/editor/viewer access.
- [ ] **Phase 4: Durable Boards and Recovery** - Reopen saved work across browsers and service restarts, and deploy, back up, and restore it.
- [ ] **Phase 5: Real-Time Collaborative Editing** - Coedit with presence, personal undo, safe reconnect, and active access revocation.
- [ ] **Phase 6: Follow Me** - Follow a presenter's viewport and return to independent navigation.
- [ ] **Phase 7: Entity Comments** - Keep persistent discussion attached to specific canvas entities.
- [ ] **Phase 8: Shared Timer** - Run a timer that remains consistent across participants, refreshes, and late joins.
- [ ] **Phase 9: Voting** - Invite participants to vote on selected cards with individual allowances and reveal results.
- [ ] **Phase 10: Reusable Product and Roadmap Templates** - Reuse product exercises and ordinary-object roadmap compositions.
- [ ] **Phase 11: Editable Mockups** - Compose editable mockup screens alongside reference images and notes.
- [ ] **Phase 12: Technical Diagram Palettes** - Build product flows, sequence diagrams, swimlanes, and C4-style diagrams with connected objects.
- [ ] **Phase 13: Manual Gantt Widget** - Turn manually entered tasks and dates into a navigable, persistent Gantt timeline.

## Phase Details

### Phase 1: Editable Canvas and Image Portability

**Goal**: As a canvas user, I want to compose editable content with reference images and export it, so that I can develop and share visual plans.
**Approved outcome:** Users can compose and arrange editable canvas content, incorporate reference images, and take useful image exports away from the board.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CAN-01, CAN-02, IMG-01, IMG-02, IMG-03
**Success Criteria** (what must be TRUE):

  1. A user can pan and zoom an infinite canvas and create editable frames, sticky notes, formatted text, shapes, arrows, connectors, and freehand drawings. (CAN-01)
  2. A user can select, move, resize, group, align, duplicate, layer, and style objects to arrange a readable board. (CAN-02)
  3. A user can import local images, including an exported Miro board and a screen capture, and arrange them alongside editable canvas content. (IMG-01)
  4. A user can export board content to an image that visibly preserves its text, shapes, connectors, and uploaded images. (IMG-02)
  5. A user can select a group of shapes and export an image containing only those selected shapes; unselected board content is excluded. (IMG-03)

**Plans**: 5/5 plans executed across 4 waves; planning verified.

**Wave 1**

- [x] 01-01-PLAN.md — Incorporate and validate the local editor and storage skeleton.

**Wave 2 (blocked on Wave 1)**

- [x] 01-02-PLAN.md — Canvas controls, primitive editing, and arrangement.
- [x] 01-04-PLAN.md — Whole-board PNG export, requested scale, and recovery.

**Wave 3 (blocked on Plan 01-02)**

- [x] 01-03-PLAN.md — Local image picker, drop, and paste.

**Wave 4 (blocked on Plans 01-03 and 01-04)**

- [x] 01-05-PLAN.md — Selected-object and frame PNG exports.

Parallel browser checks and production builds share an exclusive execution slot; file ownership stays separate.
**UI hint**: yes

### Phase 2: Daily Mind Maps

**Goal**: Users can develop and reorganize readable mind maps through rapid keyboard editing and automatic hierarchical layout.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: MIND-01, MIND-02, MIND-03, MIND-04
**Success Criteria** (what must be TRUE):

  1. A user can create and edit a hierarchical mind map and add child and sibling nodes using the agreed keyboard shortcuts. (MIND-01)
  2. A user can collapse a branch and later expand it with every descendant and its content preserved. (MIND-02)
  3. The visible mind-map layout adapts automatically when the user changes nodes or expands and collapses branches. (MIND-03)
  4. A user can format node text and style branches while continuing to edit the mind map as a hierarchy. (MIND-04)

**Plans**: 9/9 plans complete; all four requirements verified and Phase 2 tested and approved by the user on 2026-09-15

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Native create/reopen/export tracer and fixed typography/history compatibility.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Native clipboard, object duplicate and independent board-copy preservation.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Keyboard hierarchy editing and preserved nested branch collapse.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Visibility-safe selection, Layers and hierarchy-safe arrangement.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-05-PLAN.md — Automatic anchored layout, persistent formatting and accessible controls.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-06-PLAN.md — Visible and selected-map PNG exports with the complete canvas regression gate.

**UAT correction**

- [x] 02-07-PLAN.md — Explicit contextual Properties and consistent right-side inspector.
- [x] 02-08-PLAN.md — Native More submenu and multi-selection alignment visibility.
- [x] 02-09-PLAN.md — Typography inheritance, branch copying and recoverable locks.

Each wave depends on the preceding plan; shared browser/build execution uses one exclusive slot. Detailed UI defaults remain research proposals under the user's planning authorization; native integration mechanisms are resolved in Phase 2 research.
**UI hint**: yes

### Phase 3: Okta and Board Access

**Goal**: As an internal member, I want to sign in through Okta, find my authorized boards and work within owner-controlled permissions, so that board content and images are available only to their owners and members granted access.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: AUTH-01, BOARD-01, BOARD-02, BOARD-03, BOARD-04
**Success Criteria** (what must be TRUE):

  1. A member can sign in through configurable OIDC SSO with Okta compatibility and sign out. Public validation uses synthetic settings; operator-specific validation and evidence remain outside the public repository. (AUTH-01)
  2. A signed-in member can create a named board and reopen an authorized board from the home view. (BOARD-01)
  3. The home view distinguishes private and shared boards and displays the member's role for each accessible board. (BOARD-02)
  4. A board owner can grant an internal member editor or viewer access and revoke that grant. (BOARD-03)
  5. In separate authenticated contexts, editors can modify board content, viewers can read it but cannot change it through either the interface or direct requests, and members without access cannot retrieve the board or its images through direct document, synchronization, or image requests. (BOARD-04)

**Plans**: 7/12 executed; signed authentication, private library, protected resources, native account workspace/editor and internal sharing verified. Continue with plan 03-08 board actions. Native sharing zoom and actual-provider acceptance remain final-phase obligations.

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Verify dependency provenance and prepare the authenticated test harness.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Sign in through OIDC and retain an expiring Dali session.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Create private boards and browse the authorized library.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-04-PLAN.md — Save and retrieve board-bound documents and images.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-05-PLAN.md — Prove the production account workspace before migrating editor entry.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 03-06-PLAN.md — Open account boards in the established canvas shell.

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 03-07-PLAN.md — Manage active and pending internal access.

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 03-08-PLAN.md — Rename, duplicate and delete boards through role-aware controls.

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 03-09-PLAN.md — Enforce native read-only editing and permitted viewer exports.
- [ ] 03-10-PLAN.md — Preserve interrupted work and isolate account recovery.

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 03-11-PLAN.md — Copy selected browser-local work into private account boards.

**Wave 11** *(blocked on Wave 10 completion)*

- [ ] 03-12-PLAN.md — Verify all access boundaries and record actual-provider acceptance.

**UI hint**: yes

### Phase 4: Durable Boards and Recovery

**Goal**: Members can rely on saved boards and images across browsers and service interruptions, and deployment operators can deploy and recover the service.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SAVE-01, SAVE-02, OPS-01, OPS-02
**Success Criteria** (what must be TRUE):

  1. After the service restarts, an authorized member can open a saved board and all its images in another authenticated browser with no prior local board cache. (SAVE-01)
  2. A user can distinguish pending changes, acknowledged saved changes, and save failures, including when document or image storage fails. (SAVE-02)
  3. An operator can follow the documented configuration and startup procedure to deploy Dali and its required services on operator-managed infrastructure, then open an authenticated board. (OPS-01)
  4. An operator can back up and restore board documents and images, and an authorized member can reopen the restored boards with their content and images intact. (OPS-02)

**Plans**: TBD
**UI hint**: yes

### Phase 5: Real-Time Collaborative Editing

**Goal**: Authorized participants can coedit a durable board with consistent content, visible presence, personal undo, and enforced access changes.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: CAN-03, COL-01, COL-02, COL-03, COL-04, MIND-05
**Success Criteria** (what must be TRUE):

  1. Twenty authenticated participants can edit one canvas simultaneously, see changes without refreshing, and see who is present; their board content converges and acknowledged changes remain intact. The product imposes no concurrent-participant admission cap. (COL-01, COL-02)
  2. A participant can undo and redo their own canvas edits while another participant's independent edits remain intact. (CAN-03)
  3. After a temporary disconnection, participants reconnect to the same currently permitted content without losing acknowledged saved changes. (COL-03)
  4. When an owner revokes access, the affected member's active and reconnected sessions cannot continue unauthorized reads or writes, including direct synchronization and image requests and attempted queued writes. (COL-04)
  5. Participants can concurrently edit a mind map and later save and reopen it with its hierarchy and content intact. (MIND-05)

**Plans**: TBD
**UI hint**: yes

### Phase 6: Follow Me

**Goal**: Participants can navigate a board together by following a presenter while retaining control over their own participation.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: FOLLOW-01
**Success Criteria** (what must be TRUE):

  1. A participant can choose to follow a presenter and see their viewport track the presenter's navigation across the board. (FOLLOW-01)
  2. A participant can leave following and pan or zoom independently while the presenter continues navigating. (FOLLOW-01)

**Plans**: TBD
**UI hint**: yes

### Phase 7: Entity Comments

**Goal**: Authorized participants can discuss specific canvas entities through comments that remain attached to the relevant content.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: COMMENT-01
**Success Criteria** (what must be TRUE):

  1. An authorized participant can select a specific canvas entity, add a user comment attached to it, and read comments associated with that entity. (COMMENT-01)
  2. Authorized participants can move the commented entity and reopen the board while its saved comments remain readable and attached to that same entity. (COMMENT-01)

**Plans**: TBD
**UI hint**: yes

### Phase 8: Shared Timer

**Goal**: A facilitator can time a shared exercise with a consistent remaining-time display for every participant.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: TIMER-01
**Success Criteria** (what must be TRUE):

  1. A facilitator can run a shared timer and participants on the board see a consistent remaining time. (TIMER-01)
  2. A participant who refreshes or joins after the timer starts sees the remaining time for the same running timer, accounting for elapsed time. (TIMER-01)

**Plans**: TBD
**UI hint**: yes

### Phase 9: Voting

**Goal**: Facilitators can run bounded voting on selected cards, reveal the results, and continue the discussion on editable board content.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: VOTE-01, VOTE-02, VOTE-03, VOTE-04
**Success Criteria** (what must be TRUE):

  1. A facilitator can choose eligible cards and invite participants into a voting session on those cards. (VOTE-01)
  2. A facilitator can assign each participant an individual vote allowance. (VOTE-02)
  3. A participant can vote only on eligible cards and cannot spend more than their allowance, including through concurrent attempts or retried requests. (VOTE-03)
  4. Participants can see the results after voting ends and continue editing and discussing the selected cards. (VOTE-04)

**Plans**: TBD
**UI hint**: yes

### Phase 10: Reusable Product and Roadmap Templates

**Goal**: Users can start repeatable product exercises and visual roadmaps from reusable canvas content and adapt each copy independently.
**Mode:** mvp
**Depends on**: Phase 9
**Requirements**: TPL-01, TPL-02, ROAD-01, ROAD-02
**Success Criteria** (what must be TRUE):

  1. A user can start from customer-role, PMF/pains-and-gains, assumptions/findings, and design-sprint templates and edit their instantiated canvas content. (TPL-01)
  2. A user can create a reusable template from canvas content, instantiate two copies, and edit either copy without changing the other or the saved template. (TPL-02)
  3. A user can assemble a roadmap from ordinary canvas shapes, text, icons, arrows, and colors to communicate releases, goals, features, and status. (ROAD-01)
  4. A user can start from a roadmap template and edit its ordinary canvas objects using the established canvas controls. (ROAD-02)

**Plans**: TBD
**UI hint**: yes

### Phase 11: Editable Mockups

**Goal**: Users can explore screen ideas as editable mockups placed alongside supporting reference material on the canvas.
**Mode:** mvp
**Depends on**: Phase 10
**Requirements**: DESIGN-01
**Success Criteria** (what must be TRUE):

  1. A user can create a mockup screen on the canvas and edit its constituent content and arrangement. (DESIGN-01)
  2. A user can arrange editable mockup screens alongside imported reference images and notes to compare and discuss screen ideas. (DESIGN-01)

**Plans**: TBD
**UI hint**: yes

### Phase 12: Technical Diagram Palettes

**Goal**: Users can explain product interactions and technical systems with editable diagram compositions whose connections survive object movement.
**Mode:** mvp
**Depends on**: Phase 11
**Requirements**: DIAG-01, DIAG-02
**Success Criteria** (what must be TRUE):

  1. A user can choose from expanded icon and shape palettes to create editable product flows and UML-style sequence diagrams. (DIAG-01)
  2. A user can use the palettes to compose editable swimlanes and C4-style system diagrams. (DIAG-01)
  3. A user can move connected diagram objects while their connector relationships remain attached to the intended objects. (DIAG-02)

**Plans**: TBD
**UI hint**: yes

### Phase 13: Manual Gantt Widget

**Goal**: Users can visualize manually entered tasks and dates in a persistent Gantt widget and explore its calendar timeline.
**Mode:** mvp
**Depends on**: Phase 12
**Requirements**: GANTT-01, GANTT-02, GANTT-03, GANTT-04
**Success Criteria** (what must be TRUE):

  1. A user can add a Gantt widget and manually create tasks with names, start dates, and end dates. (GANTT-01)
  2. The widget shows labeled task bars against a calendar axis and updates their position and duration when the user changes task dates. (GANTT-02)
  3. A user can navigate the Gantt timeline and distinguish tasks by their bar colors. (GANTT-03)
  4. A user can start from a Gantt template, change its tasks and dates, and save and reopen the board with the widget data intact. (GANTT-04)

**Plans**: TBD
**UI hint**: yes

## Public Repository Boundary

All source, planning, examples, test fixtures, and commit messages must remain organization-neutral. Tenant identifiers, real domains, membership data, screenshots, internal product information, production configuration, deployment overlays, and operational evidence belong exclusively in operator-controlled infrastructure. Generic configuration interfaces and synthetic examples may be public. This boundary applies to every phase, including deployment and identity acceptance.

## Delivery and Validation Rules

- Phases execute sequentially. Independent tasks may run in parallel within an approved phase after their contracts and ownership are clear. Every phase includes the interface, data handling, and verification needed to demonstrate its capability.
- The initial canvas and mind-map phases demonstrate editor workflows. Shared-team readiness requires the operator-configured OIDC, permission, durable recovery, and collaboration gates in Phases 3–5. Replacing Miro is evaluated against the complete approved v1 workflow set.
- Research precedes phase planning; plan checks precede execution; requirement verification follows each phase. Preserve applicable upstream attribution when incorporating DJAI Open Canvas and verify its exact extension interfaces early, including mind-map compatibility in Phase 1 preparation for Phase 2.
- Each requirement has one delivery phase. Subsequent features carry forward existing access, persistence, recovery, undo, concurrency, and image-export checks wherever their new content or state uses those capabilities. Rechecking an earlier requirement is regression coverage, not a second phase allocation.
- Direct role checks use separate authenticated contexts and crafted requests to document, synchronization, and image paths. Exercise revocation during active sessions and reconnect, and verify save acknowledgement, service restart, and backup restoration against persisted documents and images.
- Phase 5 planning must define the representative board/image sizes, edit workload, test duration, and responsiveness thresholds for 20 concurrent authenticated editors. Confirm that the product contains no participant admission cap. Twenty is the required measured workload; higher infrastructure capacity remains unmeasured until separately tested.
- Verify exported images visually, including mixed text/shapes/connectors/images and selected-shape exclusion. Open saved and restored content in a clean authenticated browser. Extend these checks to templates, diagrams, mind maps, and Gantt as they arrive.
- Public acceptance uses synthetic OIDC fixtures and a generic reference deployment. Real identity-provider configuration and production deployment validation occur in the operator-managed environment; their settings and evidence stay outside the public repository.

## Decisions to Resolve During Phase Planning

These are implementation/design details within the approved scope, rather than additional phase requirements.

- **Phase 1:** Export image format, resolution, frame behavior, and selection boundaries; pinned upstream compatibility and notices.
- **Phase 2:** Exact keyboard shortcuts, shared versus personal branch-collapse state, and collapsed-branch indicator behavior.
- **Phases 3–5:** New-board sharing defaults, Okta registration/claims, operator-managed hosting and storage, save acknowledgement semantics, backup/recovery objectives, and the representative 20-user workload with measurable acceptance thresholds.
- **Phases 6–9:** Presenter disconnect behavior, entity anchor lifecycle on deletion/copy/undo, comment and facilitation permissions, timer controls, and voting rules for repeated votes, anonymity, late joins, ties, and session closure.
- **Phases 10–12:** Bounded template/mockup/palette inventory from the generic examples and independent copying of content, connections, and image references.
- **Phase 13:** Calendar navigation, date boundaries, timezone interpretation, and invalid date-range handling.

## Scope Boundaries

The initial release includes ordinary-object roadmap compositions and reusable roadmap templates, plus a separate Gantt widget driven by manually entered tasks and dates. MCP creation and Plane integration are deferred to later iterations. ClickUp imports are excluded. The approved requirements remain the authority for all other exclusions and interpretation.

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Editable Canvas and Image Portability | 5/5 | Complete    | 2026-09-12 |
| 2. Daily Mind Maps | 9/9 | Complete    | 2026-09-15 |
| 3. Okta and Board Access | 7/12 | In Progress|  |
| 4. Durable Boards and Recovery | 0/TBD | Not started | - |
| 5. Real-Time Collaborative Editing | 0/TBD | Not started | - |
| 6. Follow Me | 0/TBD | Not started | - |
| 7. Entity Comments | 0/TBD | Not started | - |
| 8. Shared Timer | 0/TBD | Not started | - |
| 9. Voting | 0/TBD | Not started | - |
| 10. Reusable Product and Roadmap Templates | 0/TBD | Not started | - |
| 11. Editable Mockups | 0/TBD | Not started | - |
| 12. Technical Diagram Palettes | 0/TBD | Not started | - |
| 13. Manual Gantt Widget | 0/TBD | Not started | - |

## Coverage and Sources

**Coverage:** 42 of 42 approved v1 requirements assigned exactly once; 0 unmapped; 0 duplicated. 9 requirements complete across Phases 1 and 2; 33 requirements pending. Phase allocation is approved.

- [PROJECT.md](PROJECT.md) (core value, user workflows, constraints, and execution preferences).
- [REQUIREMENTS.md](REQUIREMENTS.md) (42 approved v1 requirements, validation expectations, exclusions, and phase traceability).
- [config.json](config.json) (fine granularity and enabled research, plan-check, and verification settings).
- [research/SUMMARY.md](research/SUMMARY.md) (research findings and risks, including the final scope update that supersedes the earlier phase proposal).

*Last updated: 2026-09-16 — Phase 3 research, UI contract and 12 implementation plans checked; ready to execute. Phase 1 and 2 acceptance is preserved.*

## Backlog

### Phase 999.1: Wireframe shapes and icons (BACKLOG)

**Goal:** Provide editable wireframe-style shapes and icons for conceptually modeling desktop and web applications on the canvas.
**Requirements:** TBD; related to Phase 11 / DESIGN-01 (Editable Mockups).
**Plans:** 0 plans

**Captured context:** A reusable palette for composing application windows/browser shells, navigation sidebars, content panels, buttons, labels, step indicators and common interface icons. These are generic visual examples derived from the supplied reference; the component inventory will be finalized during planning.

**Planning relationship:** Reconcile this palette detail with Phase 11 before promotion to avoid duplicate implementation.

Plans:

- [ ] TBD (promote with $gsd-review-backlog when ready)
