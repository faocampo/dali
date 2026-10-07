# Pitfalls Research: Dali

**Domain:** Internal collaborative canvas extending DJAI Open Canvas  
**Researched:** 2026-09-11  
**Confidence:** MEDIUM for primary-source findings; Dali risks and acceptance oracles are proposed engineering inferences.

## Evidence and scope

[PROJECT.md](../PROJECT.md) (agreed workflows, exclusions, and open decisions) establishes internal Okta users, owner/editor/viewer board roles, three-to-five-person sessions, daily mind maps, facilitation, exports, and editable MCP creation. ClickUp imports are excluded; Plane integration is deferred. Phase names below are proposed capability phases, pending roadmap approval.

Evidence tags: **I** = inspected upstream implementation; **D/MEDIUM** = official documentation, classified using the research seam; **R** = Dali-specific risk, prevention, or test proposal. An identified risk is a failure mode to prevent, not an observed Dali production incident. Upstream inspection is read-only at commit `27f8bb97b10984e04e48d7650d954d0a7ecd212c`; no runtime tests were run.

## Critical pitfalls

### 1. Board permissions enforced only in the interface or initial connection

**What goes wrong:** A viewer submits raw document updates, a removed editor keeps an open connection, or a user retrieves another board's image by object key. Signing in successfully is mistaken for board authorization. **Why:** WebSocket handlers, document APIs, blob delivery, exports, and MCP tools acquire separate access paths as features grow. **Evidence:** Scope requires per-board roles; upstream workspace uses local document/blob sources (I, U1). The MCP authorization specification addresses transport token validation; Dali's board checks remain application work (D/MEDIUM, M1; R).

**Prevention:** Centralize principal-to-board capability checks; check read access before initial document sync and asset retrieval, write access before accepting updates, and role-management rights before ACL changes. Bind active connections to authenticated principals and current board ACL versions; propagate revocation to open subscriptions. If accepting opaque CRDT updates, keep ACLs and protected session state outside client-writable document fields. Authenticate asset references against board membership. Define signed-link expiry and revocation guarantees explicitly. Already downloaded content remains on clients; promise prevention of future delivery and mutations.

**Warning signs:** UI-only disabled tools; unchecked room joins; identities trusted from presence payloads; public blob URLs for private boards; authorization cached for the lifetime of a socket.

**Phase:** Identity, board access, and shared persistence; repeat at every new transport.

**Test/oracle:** Owner/editor/viewer/unauthorized contexts attempt direct board reads, initial sync, update submission, asset fetch and MCP creation. Assert permitted state changes only. Revoke an active editor, then submit an update and request a new asset; verify rejection and subscription closure/invalidation within an agreed bound. Assert the server snapshot remains unchanged by rejected writes.

### 2. Local persistence or a connected socket presented as durable shared save

**What goes wrong:** A board disappears after restart; images exist only in the uploader's browser; reconnect replaces a newer board with an empty initialization. **Why:** Existing local lifecycle code is replaced without preserving initialization, document/blob completeness, and cleanup contracts. **Evidence:** `TestWorkspace` uses IndexedDB sources, starts engines, waits for sync, then initializes metadata. Source comments explicitly explain why initializing before restored metadata can produce an empty board (I, U1). Yjs converges when updates have been delivered; it provides update mechanics rather than the application durability acknowledgement (D/MEDIUM, Y1; R).

**Prevention:** Separate local-pending, server-acknowledged, and failed-save states. Acknowledge only after the chosen durable write boundary. Preserve original documents during migrations; version schemas and maintain recoverable snapshots/update logs. Link document and asset completion so a success state represents reopenable content. Resolve offline edits after revocation with an explicit recovery policy, without silently reauthorizing them.

**Warning signs:** Save status follows socket connection; tests reopen only the same browser; server restart is untested; blank board creation occurs before synchronization; image load success depends on local caches.

**Phase:** Shared persistence, collaboration, operational readiness.

**Test/oracle:** After acknowledged text/image edits, terminate the service, clear the test client's caches, restart and reopen from another browser. Compare native object IDs/text, asset hashes and board metadata. Drop connectivity before acknowledgement and verify a pending/error state. Replay duplicate/out-of-order updates and reconnect; compare canonical application content after all peers synchronize. Raw update byte identity is not a suitable content oracle.

### 3. Concurrent edits converge technically while undo or hierarchy becomes wrong

**What goes wrong:** Undo removes another participant's work; one undo reverses several unrelated actions; a generated diagram is undone one connector at a time; concurrent tree reparenting leaves a cycle. **Why:** Transaction origins, semantic command boundaries, and domain invariants are omitted. **Evidence:** Yjs UndoManager supports scoped types, tracked origins and capture boundaries (D/MEDIUM, Y2). Validating a tree's meaning is Dali application behavior (R).

**Prevention:** Declare origins and undo ownership for local edits, remote updates, generated batches and layout changes. Group one user action into one undo unit where the product contract requires it. Validate tree parentage, root reachability and connector endpoints; define deterministic handling of conflicting structural edits. Avoid assuming a converged CRDT proves a valid diagram.

**Warning signs:** Re-layout creates many undo entries; local undo reverses remote typing; independent sibling creation loses a branch; dangling edges appear after deletion/reparenting.

**Phase:** Collaboration and daily mind maps; extend for MCP.

**Test/oracle:** Two users edit independent and shared nodes, then each undoes once. Verify the declared ownership policy preserves other-user work. Race reparent/delete operations and assert acyclic trees, reachable preserved nodes, valid endpoints and peer convergence. Exercise undo/redo after reconnect according to the chosen history policy.

### 4. Mind-map collapse and automatic layout fight between participants

**What goes wrong:** One user's collapse hides another user's active edit; each client writes different measured coordinates repeatedly; Follow Me shows different content despite matched viewport coordinates. **Why:** Persistent tree data, derived geometry, personal view state and presenter state are mixed together. **Evidence:** Mind maps are unregistered in the inspected DJAI extension list (I, U2); Miro documents keyboard creation, collapse and automatic layout as one workflow (D/MEDIUM, C1). Yjs awareness supplies user-state propagation (D/MEDIUM, Y3). The correct Dali collapse policy is open in PROJECT.md (R).

**Prevention:** Prove the exact editor extension early. Decide personal/shared collapse before schema design. Keep descendants in the tree while hidden. Choose deterministic layout inputs and ordering, or one authoritative geometry writer; prevent view-derived updates from echoing indefinitely. Define how text measurement, font loading and presenter collapse affect following. Keep local viewport movement out of durable document history.

**Warning signs:** Nodes visibly jitter; update traffic continues while idle; collapsed children are deleted from stored state; collapsed count differs by client; keyboard focus points to a hidden node.

**Phase:** Early mind-map proof, then production mind-map collaboration and Follow Me.

**Test/oracle:** Two browsers with different viewport dimensions edit long labels while one collapses a branch and the other adds a child. Verify preservation by ID/text, chosen visibility policy, stable layout after settling, valid focus and no continuing document writes while idle. Expand and reload; compare subtree membership. For Follow Me, check both camera and declared content visibility behavior.

### 5. Facilitation rules stored as freely editable shared counters

**What goes wrong:** Participants exceed allowances through simultaneous vote requests; closing races with votes; refresh resets the timer; late joiners see different remaining time or results. **Why:** Shared fields are used without an authoritative state machine and access rules. **Evidence:** Miro documents vote allowances, selectable targets and post-session results (D/MEDIUM, C2). Dali enforcement and timing mechanisms are design inferences (R).

**Prevention:** Use authoritative session IDs, lifecycle states, revisions and timestamps. Validate voter eligibility, target eligibility and allowance in an atomic server operation. Deduplicate retries. Separate hidden vote detail from public session/result state according to the agreed visibility policy. Derive remaining time from an authoritative deadline and clock offset; persist pause duration/state. Define deletion of eligible objects, ties, repeated votes, late join and facilitator loss.

**Warning signs:** Votes are Y.Map integers any editor can modify; totals briefly exceed the limit; timer depends on decrementing each browser's interval; results are merely hidden with CSS; every refresh creates a new participant allowance.

**Phase:** Shared timer and voting, following board authorization.

**Test/oracle:** Submit parallel final-allowance votes from two tabs of one identity and retry the same request. Assert accepted votes never exceed allowance and totals equal accepted records. Race close against vote; assert a single defined cutoff. Late-join and refresh with a skewed client clock; compare remaining time with server time within an agreed tolerance. Inspect participant responses for pre-reveal data leakage.

### 6. MCP creation retries duplicate or partially publish a diagram

**What goes wrong:** Timeout followed by retry creates two mind maps; a halfway failure leaves orphan nodes; the operation targets a stale board or uses a viewer's authority. **Why:** Tool metadata, CRDT idempotency and local transactions are mistaken for a durable application command contract. **Evidence:** MCP maintainers describe idempotency annotations as hints (D/MEDIUM, M2). Yjs document-update idempotency applies to replaying the same update; new creation commands can generate new IDs (D/MEDIUM, Y1; R). `Y.Doc.transact` batches observer/update events; this does not establish a cross-store commit protocol (D/MEDIUM, Y4; R).

**Prevention:** Require explicit board ID and authenticated principal. Validate the complete bounded creation graph and references before publication. Use a principal/board/operation idempotency key with payload hash, deterministic result IDs and durable status; reject key reuse with different content. Bind authorization to the mutation boundary. Stage immutable assets if needed, then publish one coherent document batch, with a recoverable operation record for crashes between persistence steps. A CRDT transaction is only one part of that design.

**Warning signs:** Each retry generates fresh UUIDs; success precedes durable persistence; asset upload and node creation happen piecemeal; board target comes from whichever UI tab is active; `idempotentHint` is the only retry safeguard.

**Phase:** Native creation command layer and MCP creation.

**Test/oracle:** Kill the request after durable commit but before response, then retry the same key; assert exactly one object graph and identical returned IDs. Inject failure before and during publication; assert no visible partial graph or a documented recoverable operation state. Reject mismatched payload reuse, dangling references, wrong-board asset IDs, viewer writes and revoked credentials. Manually edit the resulting nodes and connectors to prove native editability.

## Moderate and cross-cutting pitfalls

| Risk / evidence | Warning signs | Prevention and proposed phase | Concrete test/oracle |
|---|---|---|---|
| Export fidelity diverges from canvas (I U3; D/MEDIUM W1; R) | Blank image tiles, clipped text, huge allocations, SecurityError | Use authorized export-readable assets and wait for fonts/images; define bounds, scale and supported object types. Canvas foundation and each semantic feature phase. | Render a mixed-content board and export at agreed scales. Compare known landmarks, object bounds and visual snapshots; ensure missing assets cause explicit failure. MDN verifies cross-origin taint can block `toBlob`; CORS configuration must coexist with access controls. |
| Version/API assumptions bypass upstream initialization (I U1/U2; R) | Imports copied from older tutorials; missing services; empty boards after upgrade | Verify exact installed package exports and lifecycle before source incorporation; pin compatible versions and keep a migration fixture. Foundation phase. | Fresh-board and saved-board fixtures survive startup, reload and dependency changes; log no missing-service errors. Current SDK documentation is a version reference, not proof of compatibility with the project's pinned version. |
| Comments/votes lose their target during copy/deletion (R) | Threads float elsewhere; copied template shows old votes | Stable IDs plus explicit anchor lifecycle; new IDs and reference remapping on copies. Comments/templates/voting phases. | Move, delete, undo and duplicate target objects; assert declared orphan/copy behavior and no source-board links leaked into a fresh template instance. |
| Manual Gantt becomes an unbounded scheduling engine (scope/R) | Dependency cascades introduced before date geometry is proven; timezone shifts bars | Store day-level semantics explicitly, define inclusive/exclusive end date and calendar mapping; keep scope to entered dates. Gantt phase. | Same dates render identically in different client timezones; cover month/year boundaries, leap days and invalid date ranges. |
| Template assets disappear or copies remain coupled (I template primitive union U4; R) | Template has placeholder image boxes; editing one copy edits another | Version template schema, retain asset references, remap graph IDs and define ownership. Reusable templates phase. | Instantiate twice with images/frames, modify one instance, delete original template under declared policy, reopen other instance and verify independent content and asset availability. |

## Technical debt and integration boundaries

| Shortcut | Immediate benefit | Cost / acceptable use |
|---|---|---|
| Local-only document/asset storage | Fast editor compatibility proof | Acceptable for an explicitly local development spike; team rollout requires durable shared storage. |
| Raw editable rectangles for all semantic objects | Fast visuals | Useful for low-fidelity mockups and visual roadmaps; mind-map hierarchy and date-driven Gantt need their own behavior contracts. |
| Global room-level write permission for everything | Simple sync path | Board editors could rewrite ACL/session fields; separate protected data before multi-user rollout. |
| A single generic creation endpoint with unbounded JSON | Small initial API | Difficult validation/recovery; define finite native command schemas and batch limits before MCP. |
| Premature task integrations | Familiar roadmap demo | Conflicts with excluded ClickUp and deferred Plane scope; use manual dates and stable IDs now. |

Okta integration must map a verified identity to Dali board permissions; final protocol, app registration and claims mapping remain undecided. Pin the MCP protocol/SDK versions separately: “v2” SDK documentation is not itself a protocol revision. These are implementation-phase decisions, not stack recommendations added by this risk review.

## Performance traps and UX detection

| Trap | Observable symptom | Prevention / benchmark |
|---|---|---|
| Every client recalculates and persists every layout | Jitter and updates while idle | Measure document-update rate after one edit and after settling; bound recalculation to affected tree and chosen layout policy. |
| Every cursor movement persisted | History growth and save activity during navigation | Ephemeral presence/viewport channel; measure zero durable content changes during a pure navigation session. |
| Huge raster export or unbounded generated graph | Memory spike, frozen tab, partial output | Bounded resolution and batch sizes, explicit refusal/recovery; benchmark representative and worst agreed fixtures. |
| Independent image fetch/decode per object instance | Slow reopen and memory growth | Asset deduplication/cache and lifecycle cleanup; measure cold reopen with repeated-image templates. |

The specified session size is three to five participants; board size, image volume and latency targets remain unknown. Set measured fixture limits during phase planning rather than inventing user-count thresholds. UX checks should make pending saves, disconnection, follow state, hidden branches and failed creation visible without losing the user's current work. [PROJECT.md; R]

## Completion checklist

- [ ] Shared save survives service restart and cold second-browser reopen, including images.
- [ ] Revoked/viewer principals cannot mutate via direct sync or MCP; unauthorized blob reads fail.
- [ ] Independent users' undo operations obey the declared history policy.
- [ ] Mind-map descendants survive collapse; layout settles under concurrent edits.
- [ ] Timer and voting pass refresh, late join, duplicate request and close-race checks.
- [ ] Each new object type appears correctly in export and reusable copies.
- [ ] MCP retry after uncertain completion returns one coherent native object graph.

## Recovery strategies

| Failure | Cost estimate (R) | Recovery procedure |
|---|---|---|
| Lost acknowledgement / uncertain MCP completion | LOW if operation journal exists | Query/replay same operation key and return original IDs; reconcile journal and durable document before reporting outcome. |
| Corrupt/missing document state | HIGH | Preserve failed state and update log, restore last validated snapshot into a recovery copy, reconcile later accepted updates, verify assets and role checks before reopening. |
| Revocation bypass | HIGH | Stop affected subscriptions/write paths, invalidate sessions or ACL caches, preserve audit evidence, verify direct-path denial before re-enabling. |
| Layout loop | MEDIUM | Disable automatic writer, preserve semantic tree, apply deterministic recalculation in a recovery copy and verify no data loss. |
| Wrong vote result | MEDIUM | Freeze session; recompute from accepted deduplicated records under recorded rules; retain original records and clearly label correction. |

## Pitfall-to-phase mapping

| Proposed phase | Prevention focus | Required oracle |
|---|---|---|
| Upstream incorporation / mind-map proof | Exact API and lifecycle compatibility | Persisted fixture reload plus native tree proof |
| Identity, board library and shared persistence | Authorization, blobs, save acknowledgements | Role matrix, revocation, restart/cold reopen |
| Collaboration and daily mind maps | Reconnect, undo, valid hierarchy, layout | Multi-context convergence and semantic invariant suite |
| Follow Me and comments | Ephemeral view state and anchors | Presenter exit/disconnect and target lifecycle |
| Timer and voting | Authoritative session transitions | Concurrent allowance/close/retry checks |
| Templates and technical diagrams | ID remapping and export coverage | Independent instances plus mixed-object export |
| Gantt | Date/calendar semantics | Timezone and boundary-date fixtures |
| MCP | Authorization, retry and coherent publication | Crash-injected exactly-one graph outcome |

## Sources and confidence

Research-plan selected websearch for focused questions. `classify-confidence --provider websearch --verified` returned **MEDIUM**. Official pages were retrieved 2026-09-11. MCP authorization is explicitly the `2025-11-25` revision, not asserted to be the latest; implementation must verify its selected protocol and SDK version. The MCP annotations article is dated 2026-03-16. Other cited pages had no checked publication date. Risk priorities, recovery costs and tests are research inferences.

- **Y1 — Yjs, Document Updates:** https://docs.yjs.dev/api/document-updates
- **Y2 — Yjs, UndoManager:** https://docs.yjs.dev/api/undo-manager
- **Y3 — Yjs, Awareness:** https://docs.yjs.dev/api/about-awareness
- **Y4 — Yjs, Y.Doc:** https://docs.yjs.dev/api/y.doc
- **M1 — Model Context Protocol, Authorization (2025-11-25):** https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- **M2 — Model Context Protocol Blog, Tool Annotations as Risk Vocabulary:** https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/
- **W1 — MDN, Use cross-origin images in a canvas:** https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image
- **C1 — Miro Help Center, Mind map:** https://help.miro.com/hc/en-us/articles/360017730753-Mind-map
- **C2 — Miro Help Center, Voting:** https://help.miro.com/hc/en-us/articles/360017572274-Voting
- **U1:** [workspace.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/workspace.ts) (TestWorkspace, IndexedDB sources, startup/restoration order).
- **U2:** [extensions.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/extensions.ts) (explicit primitive registrations; mind maps unregistered).
- **U3:** [export-board.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/export-board.ts) (board, PNG and PDF export paths).
- **U4:** [templates.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/boards/templates.ts) (starter template schema and primitive union).

