# Feature Research: Dali

**Domain:** Internal collaborative product-planning and technical-design canvas  
**Researched:** 2026-09-11  
**Confidence:** MEDIUM for ecosystem findings; implementation readiness remains unvalidated.

## Scope and evidence contract

[PROJECT.md](../PROJECT.md) (agreed workflows, priorities, exclusions, and remaining design decisions) governs scope. Mind maps are the highest daily-use priority. All active capabilities remain candidates for sequential delivery; the release grouping below is a research recommendation, pending requirements approval. ClickUp imports are explicitly excluded following the user's clarification during research. Plane integration remains deferred. Screenshot content is a visual reference only.

Evidence labels used throughout:

- **S — Scope:** User-backed PROJECT.md statements.
- **I — Implementation evidence:** Read-only inspection of local DJAI source at commit `27f8bb97b10984e04e48d7650d954d0a7ecd212c`; proves code exists in the upstream checkout. Runtime behavior and Dali integration still require verification.
- **D — Documentation:** Official vendor documentation retrieved on the research date; establishes described capability, subject to version applicability.
- **R — Research inference:** Proposed Dali behavior, effort estimate, dependency, or acceptance candidate.

The upstream README and source establish a browser-local foundation. Dali has yet to incorporate that source. BlockSuite's CRDT model is a relevant primitive; delivering shared boards also requires transport, durable storage, identity, permissions, and reconnect behavior. [U1, U2, B1, B2]

## Source-labeled capability and gap matrix

| Requested capability | Miro / ecosystem reference (D) | DJAI upstream evidence (I unless stated) | Dali gap and proposed boundary (S/R) | Effort / confidence |
|---|---|---|---|---|
| Mind-map keyboard creation, collapse, automatic layout | Miro documents Return for siblings, Tab for children, arrow navigation, default automatic layout, and collapsed-branch badges. [M1] | Selected store/view extensions register primitives but no mind-map extension. The file's explanatory comment mentions mind maps in the broader preset; this is documentation evidence, not working integration. [U3] | Prove a native editable tree early. Define shortcuts, collapse visibility, re-layout, undo, text styling, and multi-user behavior. Preserve children while collapsed. | HIGH; MEDIUM reference, readiness open |
| Infinite canvas and object editing | Miro documents editable shapes, connectors, diagram palettes, and organization tools. [M3] | Shape, connector, frame, image, text, group extensions; arrangement and inspector modules exist. [U3, U4] | Incorporate and verify ordinary creation, edit, move, resize, grouping, alignment, styling, undo/redo, keyboard focus. Icons need a defined supported catalog. | MEDIUM; code evidence |
| Images and reference-board migration | Scope specifies importing exported images of Miro boards. [S] | Image extensions and visual editing source exist; README describes local uploads. [U1, U3, U4] | Shared durable blob storage; verify a second participant and a later session can retrieve the same image. Make reference images movable/resizable alongside editable objects. | MEDIUM; code evidence |
| Board library, Okta, per-board roles | Scope explicitly defines internal members and owner/editor/viewer. [S] | BoardLibrary, catalog, and local creation/reopen operations exist; workspace uses IndexedDB document/blob sources. [U2, U5] | Add authenticated accessible-board listing, private/shared indicators, durable persistence, and server authorization. Confirm new-board defaults and ownership transfer/deletion rules. | HIGH; code evidence |
| Three-to-five-person concurrent editing | BlockSuite documents CRDT-based state and Yjs conflict resolution. [B1, B2] | Local IndexedDB wiring is visible; online board transport and ACL enforcement were not established by inspected source. [U2] | Persist and synchronize document and asset changes; verify two-way edits, reconnect, revocation, and recovery across separate browsers. | HIGH; MEDIUM |
| Follow Me | Miro Attention Management includes following collaborators and guiding attention. [M4] | No feature-specific implementation located in inspected application source. | Presence plus viewport following, visible follow state, participant exit, and presenter-disconnect handling. Define whether an invitation or forced start is wanted. | MEDIUM; MEDIUM |
| Shared timer | User requires shared facilitation timer. [S] | No facilitation-timer implementation located; local timeout utilities serve other purposes. | Authoritative session end time, start/pause/end policy, late join and refresh consistency. Exact facilitator permissions remain open. | MEDIUM; R |
| Voting | Miro documents eligible-object selection, per-person limits, optional one vote per object, join/skip, and results after the session. [M2] | No voting-session implementation located in inspected source. | Select eligible cards, invite board participants, enforce allowances, close/reveal, retain links to original editable cards. Define duplicate-vote, anonymity, tie, and deleted-card rules. | HIGH; MEDIUM |
| Comments | Miro documents board/object comments, replies, and resolution; object-attached comments move with their object. [M5] | No comment-thread feature established in inspected source. | Persistent object or coordinate anchors, replies and resolution candidates; define viewer permissions and anchor-deletion behavior. Mentions/email delivery require separate scope decisions. | MEDIUM; MEDIUM |
| UML-style sequence, swimlane, C4-style diagrams | Miro documents UML packs and horizontal/vertical swimlanes. C4 semantic completeness was not established by the opened Miro page. [M3] | Basic shape/connector primitives are available. Dedicated UML/C4/swimlane types were not established. [U3] | Curated palettes and editable templates. Sequence needs lifelines/messages; swimlanes need lane labels and membership behavior; C4 needs people, systems, containers/components, boundaries, labeled relationships. Formal model validation remains a separate decision. | MEDIUM–HIGH; R |
| Product templates and mockups | User requires customer roles, PMF, pains/gains, assumptions/findings, and design sprints. [S] | Four starter IDs: blank, brainstorm, mood-board, storyboard. Template primitives cover text, shapes, sticky notes; current template type omits image/frame primitives. [U6] | Extend template composition and reusable saved templates to include requested structures and image references. Define independent copies, asset retention, and sharing ownership. Use editable low-fidelity mockup components. | MEDIUM; code evidence |
| Visual roadmaps | User specifies releases, goals, features, color, arrows, icons, status/progress. [S] | Shape/text/sticky/connector primitives support composition. Dedicated roadmap behavior was not established. [U3, U6] | Template-led roadmap creation; editable labels and status markers. Define a small icon/status vocabulary. | LOW–MEDIUM; R |
| Manual date-driven Gantt | User specifies manually entered tasks with start/end-driven bars and a navigable calendar. [S] | A calendar/task-date model was not established in inspected application source. | A dedicated task schema and calendar geometry: labels, colors, rows, date validation, month navigation, deterministic date-to-position mapping. | HIGH; R |
| Image export | Miro mind maps can be exported as images or PDF. [M1] | Export implementation has PNG and PDF paths and board rendering. [U7] | Verify images, rich text, new semantic objects and large boards export correctly; select exact resolution and board/frame/selection scope in requirements. PDF is existing upstream evidence, not an added Dali commitment. | MEDIUM; code evidence |
| MCP-created editable diagrams and mind maps | User explicitly requests MCP services. [S] | No MCP service established in inspected source. | Board-targeted authenticated creation commands using native object IDs, schema validation, finite batch sizes, and idempotent retry. Return created IDs so agents and humans can inspect/edit results. | HIGH; R |

Absence statements above mean the feature was not established in the inspected application files; they do not assert impossibility or exhaustive absence in BlockSuite dependencies. Complexity is an estimate of Dali integration work, not a schedule.

## Table stakes for the team's replacement decision

| Feature cluster | Why expected for deployment operators | Priority recommendation |
|---|---|---|
| Reliable editable canvas with durable images and reopen | Every described workflow depends on content remaining accessible across sessions. [S] | Foundation and first usable slice |
| Daily keyboard-driven mind maps | Explicit daily-use priority; three operations must form one coherent workflow: add, collapse/expand, re-layout. [S, M1] | Earliest specialty capability |
| Okta and enforceable owner/editor/viewer access | Required internal deployment and private/shared board handling. [S] | Before shared internal rollout |
| Small-group collaboration | The product-ideation workflow uses three to five participants. [S] | Before team-session pilot |
| Follow, timer, voting, comments | Required design-sprint loop includes facilitation, prioritization, and continued iteration. [S] | Before declaring that workflow replaced |
| Requested palettes, mockups, templates, roadmap/Gantt | Each serves a named user workflow. [S] | Sequential capability phases after foundation |
| Editable MCP creation and image export | Explicit agent/portability scope. [S] | Initial-scope delivery with native-object acceptance |

These clusters express workflow completeness. A thin pilot can arrive earlier; it should be labeled by the workflows it supports.

## Differentiators within agreed scope

| Capability | Value proposition | Implementation implication |
|---|---|---|
| Agent-created content in the same editable canvas | Team members immediately refine generated technical diagrams and mind maps. [S/R] | Share the native command/schema layer with manual tools; preserve selection, connectors, labels, and undo semantics. |
| organization-neutral reusable workshop layouts | Customer-role, PMF, pains/gains, and assumptions/findings layouts reduce setup for recurring sessions. [S/R] | Build reusable editable compositions with asset references and independent instances. |
| One internal workspace for mind mapping and solution design | Supports the named daily workflow and the technical handoff without moving material between tools. [S/R] | Validate cross-feature behavior: tree plus images plus sequence diagram plus comments on one board. |

These are differentiation hypotheses for deployment operators adoption, not claims of exclusive market capabilities.

## Scope exclusions and expansion traps

| Item | Scope decision | Supported approach |
|---|---|---|
| General Miro parity | Excluded [S] | Evaluate only named workflows and their necessary interactions. |
| Editable Miro-board migration | Excluded initially [S] | Import exported board images as references; create fresh editable work. |
| ClickUp imports | Explicitly excluded during research [S] | Keep connector work out of requirements and estimates. |
| Plane integration | Deferred [S] | Manual roadmap/Gantt now; preserve stable IDs for future task linkage. |
| Video calls, slide presentation, general spreadsheets, external guests | Excluded initially [S] | Separate conferencing, canvas-based presentation ideation, focused layouts/Gantt, internal Okta users. |
| Automatic Gantt dependency scheduling, critical paths, resource planning | Additional behavior requires a scope decision [R] | Implement date-driven bars using user-entered dates. |
| Full UML conformance / architecture repository / AI chat copilot | Additional behavior requires a scope decision [R] | Editable curated diagrams and MCP creation as requested. |

## Feature dependencies and recommended delivery order

```text
Validated upstream canvas + stable native object IDs
  -> early mind-map compatibility proof
  -> durable documents/assets + Okta + board access + board library
  -> multi-user synchronization and recovery
  -> completed daily mind-map workflow with concurrent-edit checks
  -> presence and Follow Me
  -> comments -> shared timer -> voting
  -> reusable product templates and mockups
  -> specialized technical diagram palettes
  -> visual roadmap templates -> manual date-driven Gantt
  -> MCP creation of proven native diagrams and mind maps
```

This is a proposed sequential delivery order, not a dependency claim that every later capability technically requires every previous capability. Mind maps merit an early proof before committing heavily to the chosen editor extension. Their production completion depends on persistence and shared-state decisions. Basic templates can be reused during early testing; reusable authoring and image-containing templates need the later asset/copy contract. Image export is a cross-cutting acceptance obligation whenever a new object type ships. [R]

True prerequisites:

- Role checks and durable board IDs precede shared board access, comments, facilitation mutations, and MCP writes.
- Stable object IDs precede comment anchors, vote targets, template copies, and generated connectors.
- Presence and viewport events precede Follow Me; persisted document changes remain separate from per-user viewport state.
- Shared timer/voting state needs server-controlled transitions and permissions; a shared editable canvas alone cannot enforce vote allowances.
- Gantt requires task dates and a calendar mapping; roadmap rectangles alone do not establish it.
- MCP needs the finalized native schemas for the object types it creates. Framework selection or an MCP connection alone does not prove editable generation.

## Acceptance candidates for requirements discussion

All candidates are proposed verification targets (R), not approved requirements or implementation evidence. Choose sizes and timing tolerances using representative boards during phase planning.

| Capability | Candidate executable check | Decision needed |
|---|---|---|
| Mind-map creation | Create root, two sibling branches, and nested children with keyboard; edit long text; verify parent IDs, focus target, node count, readable layout, and undo/redo. | Exact shortcuts and navigation behavior |
| Collapse and layout | Collapse a subtree, verify descendants remain in stored state, expand and compare IDs/text; repeat after reload and concurrent child creation. Verify visible nodes avoid overlap and connected branches remain correct. | Personal versus shared collapse; badge count definition |
| Board access | Owner grants editor/viewer; each role opens permitted board; direct unauthorized document/blob reads and writes fail; role revocation affects an already-connected session. | New-board default; comment/facilitator roles |
| Collaboration | Three to five isolated authenticated browser contexts concurrently create/edit/move content; compare document state after reconnect and reopen. | Offline-edit policy, latency tolerance, representative board size |
| Images | Upload an image, reopen in another browser and after server restart, resize and export it; verify asset access follows board permissions. | Accepted formats and size/resolution limits |
| Follow Me | Start following, pan/zoom presenter, verify follower viewport; stop following and retain independent navigation; disconnect presenter. | Invitation, forced start, and interruption policy |
| Timer | Join after timer starts, refresh, pause/resume/end from permitted role; verify displayed remaining time against authoritative end time. | Allowed roles, clock tolerance, persistence between sessions |
| Voting | Select eligible cards, allocate votes, reject out-of-scope and excess votes, retry a vote request without duplication, close/reveal totals, edit the original winning card. | Multiple votes per card, anonymity, ties, late join, deleted target |
| Comments | Anchor a thread to a shape, move shape, reply from another session, resolve/reopen, reload. | Viewer write rights and anchor deletion/copy semantics |
| Templates/mockups | Save requested workshop layout with frame/text/notes/image; instantiate twice; edit one and verify independence of other instance. | Template ownership/sharing and eligible object types |
| Technical diagrams | Build and reopen a sequence diagram, swimlane flow, and C4-style view; move participants/boundaries and verify expected label/connector behavior. | Required semantic interactions versus composed objects |
| Gantt | Enter tasks spanning a month boundary and leap day; change start/end dates and verify bar geometry; reject reversed dates; navigate calendar and reopen. | Inclusive end date, day/week scale, drag-to-change-date policy |
| MCP | Generate into explicitly selected permitted board, edit returned objects manually, retry safely, reject malformed references and viewer writes. | Authentication, target selection, confirmation/batch limits |
| Export | Export representative mixed-content board including map, images, diagrams and Gantt; verify readable text, complete bounds, fonts and asset rendering. | Formats, resolution, board/frame/selection scope |

## Research gaps and next decisions

- The user-level mind-map behavior must be proven against BlockSuite 0.22.4 and the curated DJAI extensions. Current BlockSuite marketing/documentation establishes general architecture, not that exact integration.
- Facilitation and comments need a capability matrix separate from the three broad board roles. Private new-board defaults remain proposed.
- Collapse visibility is consequential for simultaneous mind-map work and Follow Me; settle it before the persistent schema and acceptance suite.
- Timer-specific Miro documentation fetch failed; the timer row is grounded in user scope and proposed design only. Gantt and MCP rows are also scoped recommendations, not claims of vendor parity.
- The local source was inspected, with no installs or browser/runtime checks. Existing tests were not executed, so test-file presence is not reported as a passing result.

## Sources and research method

Confidence classifier: `gsd-tools.cjs query classify-confidence --provider websearch --verified` returned **MEDIUM**. Research-plan seam selected websearch for ecosystem questions and Context7 for BlockSuite. Context7 MCP and `ctx7` CLI were unavailable, so official web documentation was used; digests were cached through research-store. Current Miro pages were retrieved 2026-09-11; visible publication dates were unavailable. BlockSuite's architectural article is dated 2023-04-15 and is used for design principles, with the current homepage as corroboration.

### Primary external references (D, MEDIUM)

- **M1 — Miro Help Center, Mind map:** https://help.miro.com/hc/en-us/articles/360017730753-Mind-map
- **M2 — Miro Help Center, Voting:** https://help.miro.com/hc/en-us/articles/360017572274-Voting
- **M3 — Miro Help Center, Miro for mapping & diagramming:** https://help.miro.com/hc/en-us/articles/4403634496402-Miro-for-mapping-diagramming
- **M4 — Miro Help Center, Attention management:** https://help.miro.com/hc/en-us/articles/360013358479-Attention-management
- **M5 — Miro Help Center, Comments:** https://help.miro.com/hc/en-us/articles/360017730873-Comments
- **B1 — BlockSuite, Content Editing Tech Stack:** https://blocksuite.io/
- **B2 — BlockSuite, CRDT-Native Data Flow:** https://blocksuite.io/blog/crdt-native-data-flow
- **DJAI Academy, upstream repository:** https://github.com/DJAI-Academy/djai-open-canvas

### Inspected local implementation references (I)

- **U1:** [README.md](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/README.md) (documented canvas capabilities, client-local storage, and exports).
- **U2:** [workspace.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/workspace.ts) (IndexedDB document/blob sources and workspace lifecycle).
- **U3:** [extensions.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/extensions.ts) (explicit selected BlockSuite store/view registrations).
- **U4:** [arrangement.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/arrangement.ts) (object arrangement operations) and [image-visual-edits.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/image-visual-edits.ts) (image visual editing extensions).
- **U5:** [BoardLibrary.tsx](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/boards/BoardLibrary.tsx) (local board browser and template picker).
- **U6:** [templates.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/boards/templates.ts) (starter definitions and supported primitive union).
- **U7:** [export-board.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/export-board.ts) (PNG/PDF generation paths).

