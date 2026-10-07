# Requirements: Dali

**Defined:** 2026-09-11
**Status:** All 42 v1 requirements and their 13-phase allocation are approved.
**Core Value:** Product and engineering teams can collaboratively turn ideas into clear product and technical plans on a shared, editable canvas that supports their daily work well enough to replace Miro.

## v1 Requirements

Initial release includes the capabilities below. Delivery proceeds through small sequential phases; completion of an early phase alone does not establish readiness to replace Miro.

### Identity and board access

- [x] **AUTH-01**: Members can sign in through configurable OIDC SSO with Okta compatibility and sign out of Dali. Real-provider configuration and acceptance are deferred by the user (2026-09-24) to backlog 999.4 until operator access is available; existing generic OIDC behavior remains in scope.
- [x] **BOARD-01**: Eligible internal members can create named boards and reopen boards they are authorized to access from a home view.
- [x] **BOARD-02**: The home view identifies private and shared boards and the member's role on each board.
- [x] **BOARD-03**: Board owners can grant and revoke editor or viewer access for internal members.
- [x] **BOARD-04**: Editors can modify board content, viewers can view it, and members without access cannot retrieve board content or its images.

### Canvas and images

- [x] **CAN-01**: Users can pan and zoom an infinite canvas and create editable frames, sticky notes, formatted text, shapes, arrows, connectors, and freehand drawings.
- [x] **CAN-02**: Users can select, move, resize, group, align, duplicate, layer, and style canvas objects.
- [ ] **CAN-03**: Users can undo and redo their own canvas edits without undoing another participant's independent edits.
- [x] **IMG-01**: Users can import local images, including exported Miro boards and screen captures, and arrange them on the canvas.
- [x] **IMG-02**: Users can export board content to an image that preserves the visible text, shapes, connectors, and uploaded images.
- [x] **IMG-03**: Users can select a group of shapes and export only the selected shapes as an image, excluding unselected board content.

### Persistence and collaboration

- [x] **SAVE-01**: Users can reopen saved boards and their images from another authenticated browser after the service restarts.
- [x] **SAVE-02**: Users can distinguish saved changes from pending changes or save failures.
- [ ] **COL-01**: Authorized participants can edit the same canvas concurrently and see one another's changes without refreshing, with no product-enforced concurrent-user cap. Validate simultaneous editing with 20 users on one canvas; 20 is the validation target, not an admission limit or a claim of unlimited infrastructure capacity.
- [ ] **COL-02**: Participants can see who is currently present on their board.
- [ ] **COL-03**: After a temporary disconnection, participants can reconnect and converge on the same permitted board content without losing acknowledged saved changes.
- [ ] **COL-04**: Access revocation prevents further unauthorized reads and writes through active or reconnected sessions.

### Mind maps

- [x] **MIND-01**: Users can create and edit hierarchical mind maps and add child and sibling nodes through keyboard shortcuts.
- [x] **MIND-02**: Users can collapse and expand branches without deleting or changing their descendants.
- [x] **MIND-03**: Mind-map layout automatically adapts when nodes change or branches expand and collapse.
- [x] **MIND-04**: Users can format node text and style mind-map branches.
- [ ] **MIND-05**: Mind maps retain their hierarchy and content after saving, reopening, and concurrent editing.

### Facilitation

- [ ] **FOLLOW-01**: Participants can follow a presenter's viewport and leave following to navigate independently.
- [ ] **COMMENT-01**: Authorized participants can add and read persistent user comments attached to a specific canvas entity, following the entity-anchored interaction described by the user with Miro as a reference.
- [ ] **TIMER-01**: A facilitator can run a shared timer whose remaining time stays consistent for participants, including those who refresh or join late.
- [ ] **VOTE-01**: A facilitator can choose eligible cards and invite participants to a voting session.
- [ ] **VOTE-02**: A facilitator can assign a vote allowance to each participant.
- [ ] **VOTE-03**: Participants can cast votes on eligible cards within their individual allowance.
- [ ] **VOTE-04**: Participants can see the results after voting ends and continue editing and discussing the selected cards.

### Templates, mockups, and technical diagrams

- [ ] **TPL-01**: Users can start from reusable customer-role, PMF/pains-and-gains, assumptions/findings, and design-sprint templates.
- [ ] **TPL-02**: Users can create reusable templates from canvas content and instantiate independently editable copies.
- [ ] **DESIGN-01**: Users can create editable mockup screens on the canvas and arrange them alongside reference images and notes.
- [ ] **DIAG-01**: Users can choose from expanded icon and shape palettes to create product flows, UML-style sequence diagrams, swimlanes, and C4-style diagrams.
- [ ] **DIAG-02**: Users can move connected diagram objects while retaining their connector relationships.

### Roadmap compositions and Gantt widget

- [ ] **ROAD-01**: Users can assemble roadmaps from ordinary canvas shapes, text, icons, arrows, and colors to communicate releases, goals, features, and status.
- [ ] **ROAD-02**: Users can start from a roadmap template and edit its ordinary canvas objects.
- [ ] **GANTT-01**: Users can add a Gantt widget and manually create tasks with names, start dates, and end dates.
- [ ] **GANTT-02**: The Gantt widget renders labeled task bars against a calendar axis and updates their position and duration when input dates change.
- [ ] **GANTT-03**: Users can navigate the Gantt timeline and distinguish tasks using bar colors.
- [ ] **GANTT-04**: Users can start from a Gantt template and retain widget task/date data after saving and reopening the board.

### Deployment

- [x] **OPS-01**: Deployment operators can deploy Dali and its required services on operator-managed infrastructure using documented configuration and startup procedures.
- [x] **OPS-02**: Deployment operators can back up and restore board documents and images and verify that restored boards reopen with their content intact.

**Approved validation deferral (2026-09-27):** Independent storage failure-domain and retention-capacity validation for OPS-01/OPS-02 is postponed to backlog 999.6. These checks remain unverified and are excluded from active Phase 4 acceptance. Local deployment/recovery validation and native Viewer rendering remain in scope.

## v2 Requirements

Deferred to later iterations; exact later release allocation remains open.

- **MCP-01**: AI agents can create editable diagrams and mind maps from instructions through authenticated, board-authorized MCP services.
- **PLANE-01**: Users can link board cards/action items to tasks in Plane.
- **PLANE-02**: Users can source task data from Plane for planning views.

## Out of Scope

| Feature | Reason |
|---------|--------|
| ClickUp imports | Explicitly removed by the user. |
| Editable Miro-board migration in v1 | Initial migration uses new boards and exported reference images. |
| External guest access in v1 | Initial users are signed-in internal members. |
| Video-conferencing integration | Teams use a separate conferencing application. |
| Slide presentations | Presentation ideation is supported through canvas compositions. |
| General spreadsheet-style tables | Templates use structured visual layouts; Gantt uses task/date inputs. |
| Broad Miro feature parity | Scope is the explicitly described deployment operators workflows. |

## Public Repository Boundary

All deliverables must be organization-neutral. Keep real organizational information, identity-provider settings, infrastructure identifiers, deployment configuration, and private evidence outside this repository. Public configuration examples and validation fixtures must use synthetic values. Operator-specific setup and production verification occur solely in operator-controlled infrastructure. This is an approved cross-cutting constraint on all 42 requirements.

## Constraints and Interpretation

- Extend DJAI Open Canvas and preserve applicable license notices.
- Use deployment operators Okta SSO and deploy on operator-managed infrastructure.
- Roadmap objects use ordinary canvas primitives and templates. Gantt is a semantic widget with task/date input.
- Presentation ideation is covered by image import, notes, and canvas arrangement.
- Persistence, permission enforcement, recovery, and collaboration validation are derived quality requirements for the agreed shared-team workflow. These are proposed acceptance obligations, not claims of existing functionality.
- Keyboard mappings, collapse-state ownership, comment/facilitation permissions, vote rules, export format/resolution/scope, and default sharing behavior remain for the relevant phase discussions.
- Diagram palettes and mockup controls should be bounded by the generic examples and phase design contracts. Formal UML validation, interactive prototyping, and automatic scheduling/dependency calculation have not been requested.
- Research technology recommendations are candidates pending validation, rather than locked implementation choices.

## Validation Expectations

- Verify all requirements using repeatable automated checks where feasible.
- Collaboration and role checks use separate authenticated contexts, direct request tests, and reconnect/restart scenarios.
- Validate one canvas with 20 concurrent authenticated users performing edits; verify convergence and preservation of acknowledged changes. Do not introduce a participant admission cap. Board size, workload, duration, and responsiveness thresholds are to be specified during phase planning; capacity beyond this test remains unmeasured.
- Verify image exports visually and verify persisted data after opening in a clean browser.
- Validate generic identity and deployment behavior with synthetic fixtures in public artifacts. Real identity-provider setup and deployment verification occur in the operator-managed environment; keep all associated settings and evidence there.
- Treat synthetic identity or infrastructure fixtures as development evidence, with actual-environment checks tracked separately.

## Traceability

The phase allocation below is approved in [ROADMAP.md](ROADMAP.md) (sequential MVP capabilities and success criteria). Five Phase 1, four Phase 2 and five approved Phase 3 requirements are complete; the remaining 28 requirements are pending. Actual-provider and spoken assistive-technology acceptance retain their separate approved backlog dispositions.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 3 | Complete |
| BOARD-01 | Phase 3 | Complete |
| BOARD-02 | Phase 3 | Complete |
| BOARD-03 | Phase 3 | Complete |
| BOARD-04 | Phase 3 | Complete |
| CAN-01 | Phase 1 | Complete |
| CAN-02 | Phase 1 | Complete |
| CAN-03 | Phase 5 | Pending |
| IMG-01 | Phase 1 | Complete |
| IMG-02 | Phase 1 | Complete |
| IMG-03 | Phase 1 | Complete |
| SAVE-01 | Phase 4 | Accepted with recorded deferrals |
| SAVE-02 | Phase 4 | Accepted with recorded deferrals |
| COL-01 | Phase 5 | Pending |
| COL-02 | Phase 5 | Pending |
| COL-03 | Phase 5 | Pending |
| COL-04 | Phase 5 | Pending |
| MIND-01 | Phase 2 | Complete |
| MIND-02 | Phase 2 | Complete |
| MIND-03 | Phase 2 | Complete |
| MIND-04 | Phase 2 | Complete |
| MIND-05 | Phase 5 | Pending |
| FOLLOW-01 | Phase 6 | Pending |
| COMMENT-01 | Phase 7 | Pending |
| TIMER-01 | Phase 8 | Pending |
| VOTE-01 | Phase 9 | Pending |
| VOTE-02 | Phase 9 | Pending |
| VOTE-03 | Phase 9 | Pending |
| VOTE-04 | Phase 9 | Pending |
| TPL-01 | Phase 10 | Pending |
| TPL-02 | Phase 10 | Pending |
| DESIGN-01 | Phase 11 | Pending |
| DIAG-01 | Phase 12 | Pending |
| DIAG-02 | Phase 12 | Pending |
| ROAD-01 | Phase 10 | Pending |
| ROAD-02 | Phase 10 | Pending |
| GANTT-01 | Phase 13 | Pending |
| GANTT-02 | Phase 13 | Pending |
| GANTT-03 | Phase 13 | Pending |
| GANTT-04 | Phase 13 | Pending |
| OPS-01 | Phase 4 | Accepted with recorded deferrals |
| OPS-02 | Phase 4 | Accepted with recorded deferrals |

**Coverage:**

- v1 requirements: 42
- Mapped to phases: 42 (approved allocation)
- Unmapped: 0
- Duplicate phase assignments: 0

## Sources

- [PROJECT.md](PROJECT.md) (authoritative user scope, constraints, and screenshot references).
- [Research summary](research/SUMMARY.md) (evidence, architectural recommendations, and post-research scope update).
- [Feature research](research/FEATURES.md) (capability gaps and acceptance candidates).
- [Risk research](research/PITFALLS.md) (derived reliability and authorization checks).

User scope decisions supersede earlier research proposals, particularly the deferral of MCP creation and use of ordinary shapes for roadmaps.

---
*Last updated: 2026-09-25 after Phase 3 acceptance; 14 requirements complete, 28 pending, with actual-provider and spoken assistive-technology acceptance explicitly deferred.*

**Phase 4 acceptance (2026-09-29):** User accepted Phase 4 as validated on 2026-09-29 and explicitly deferred the remaining WebKit Save Details runtime-error fix to backlog 999.7. The observed full run remains 2,051/2,052 passed, one failed, zero skips/retries; this is acceptance with an explicit exception. Independent storage/capacity remains deferred to 999.6.
