# Architecture Research

**Project:** Dali
**Domain:** Internal collaborative infinite canvas, visual planning, editable mind maps and agent-created diagrams
**Researched:** 2026-09-11
**Confidence:** MEDIUM — inspected upstream source and official documentation; proposed integration has not been built or runtime-validated.

## Recommendation

Extend the upstream React/BlockSuite canvas with a modular Dali backend that owns identity sessions, board membership, durable collaboration, assets, workshop state, and MCP commands. Keep deployment on operator-managed infrastructure. Begin with one collaboration service instance and durable storage; select the actual infrastructure products during deployment planning.

Use one board as the authorization and synchronization boundary. Give each board an isolated BlockSuite workspace/document namespace, with its required metadata and subordinate documents mapped to that board by the server. Keep the board library and membership records in server-owned application storage. This avoids making an all-board client workspace responsible for filtering private metadata.

These are design recommendations derived from the project requirements and evidence below. Database shape, protocol wrappers, source adapters, and endpoint examples in this document are proposals, rather than verified BlockSuite APIs.

## Evidence and version boundaries

| Evidence | Finding | Applicability and confidence |
|---|---|---|
| DJAI upstream clean checkout at `27f8bb97b10984e04e48d7650d954d0a7ecd212c` | Dependencies pin BlockSuite packages to 0.22.4. Workspace construction injects IndexedDB document/blob sources into `TestWorkspace`; engines start before metadata initialization. | Direct local source inspection; MEDIUM integration confidence. [S1–S3] |
| Upstream extension registry and template/text creation | Explicit store/view extension lists and typed template primitives provide extension seams. Existing creation uses BlockSuite store/surface objects and shared text. | Pinned application evidence; runtime capability still requires validation. [S4–S5] |
| Public BlockSuite store guide | Describes Yjs-backed stores, subdocuments, awareness and `DocCollection`. | Conceptual evidence only: API examples differ from the pinned application's `TestWorkspace` imports. [S6] |
| Yjs provider and awareness documentation | Providers handle document transport; subdocument synchronization needs explicit provider support; awareness is ephemeral. | Current official guidance, MEDIUM. Validate actual dependency versions and adapters before implementation. [S7–S9] |
| Okta official guides | Authorization-code web login and ID-token validation support a server-side session architecture. Organization and custom authorization servers have different intended uses. | Current guidance, MEDIUM. Operator-specific issuer, claims, policies and app registration remain unverified. [S10–S12] |
| MCP specification 2026-07-28 and TypeScript SDK v2 documentation | Current protocol uses request metadata and removes protocol session initialization; tools use schemas, and protected HTTP resources require authorization. | Versioned official specification cross-checked with release announcement and stable SDK documentation, MEDIUM. Target agent-client support remains unverified. [S13–S16] |

Research used GSD `research-plan` and `classify-confidence`. The plan selected Context7; neither its MCP tools nor `ctx7` CLI was available. Built-in web search/open of official sources supplied the fallback; `classify-confidence --provider websearch --verified` returned MEDIUM. Digests were cached. No package install or live integration was performed. Native Read/Write tools were unavailable; shell reads and the filesystem patch tool supplied the equivalent artifact operations.

## System overview

```text
Browser                                      Agent MCP client
  React board library + canvas                 structured tool calls
  BlockSuite 0.22.4 adapter                     explicit boardId/requestId
  local pending cache + presence                       |
         | HTTPS / authenticated WebSocket             | HTTPS
         v                                            v
  Dali backend — shared authorization and application services
  ├── OIDC callback + Dali sessions <────────────── Okta
  ├── Board directory + owner/editor/viewer policy
  ├── Collaboration rooms + document persistence receipts
  ├── Asset access/upload service
  ├── Comments + voting + timer session service
  └── MCP tools → validated canvas command executor
         |                         |
         v                         v
  Transactional durable store    Private durable blob store
  boards, members, operations,    uploaded images, thumbnails,
  workshop data, update log,      export artifacts if retained
  snapshots, asset manifest
```

The logical modules may share a process initially. A background worker becomes useful for compaction, thumbnails, or browser-dependent rendering once those operations need isolation. Hosting provider, container platform, object-store implementation, database engine, and availability targets remain deployment choices.

### Component responsibilities

| Component | Owns | Boundary rule |
|---|---|---|
| Web application | Navigation, board controls, viewport, interaction feedback | Fetch accessible-board metadata from the backend; open only the selected board's namespace. |
| Canvas adapter | Pinned BlockSuite imports, extension registration, document lifecycle, element creation and export | Keep library-specific types inside this module; expose application commands and semantic models. |
| Identity/session service | OIDC login callback, validated identity, local sessions, session expiry | Resolve users through a stable issuer/subject identity; access policy reads server records. |
| Board service | Board ID/title, membership, owner transfer, deletion and document ownership mapping | Authorize every board operation and every subordinate resource against its owning board. |
| Collaboration service | Authorized rooms, update validation limits, persistence acknowledgement, reconnection | Enforce read versus write access on incoming protocol messages, including sync responses containing client updates. |
| Blob service | Upload validation, content storage, board-to-asset manifest, authorized reads | Durable asset receipt precedes declaring an image safely saved; content-addressed keys still require authorization. |
| Workshop service | Comments, vote allowances/ballots/results, timer and presenter session ownership | Server transactions enforce constrained actions; participants receive an authorized projection of state. |
| Canvas command executor | Schema checks, graph validation, ID allocation, native object generation | UI templates and MCP operations use the same conversion rules. |
| MCP adapter | Tool discovery, per-request auth, scope checks, response schema | Explicit target board and request key; invoke application commands after board authorization. |

## State ownership and persistence

| State | Canonical owner | Recommended representation |
|---|---|---|
| Board title/library/membership | Dali backend | Transactional records; optional canvas title is a derived display projection. |
| Shapes, notes, rich text, connectors, frames | Board document | BlockSuite/Yjs state, durable updates plus periodic snapshots. |
| Mind-map topology and user-authored content | Board document | Native supported mind-map model if spike succeeds; otherwise a Dali semantic graph with native canvas projections. |
| Gantt task dates and row order | Board document | Typed date-based model; derive bar geometry from a shared calendar configuration. |
| Asset bytes | Private durable blob store | Immutable blobs referenced through a board-owned manifest. |
| Comments and moderation | Workshop service | Stable object ID or board-coordinate anchors, author identity, thread state; handle deleted anchors explicitly. |
| Voting ballots and allowances | Workshop service | Server-validated records and reveal-gated aggregates. |
| Shared timer | Workshop service | Authoritative start/deadline and pause state; clients derive display using clock-offset estimation. |
| Cursors, selections, viewport broadcasts | Awareness channel | Expiring presence state, rate-limited per authenticated participant. |
| Follow preference and personal branch collapse | Browser/user preference | Personal by default as a proposal; shared collapse remains a requirements decision. |

Yjs awareness is designed for transient collaboration metadata [S9]. Dali should therefore store timer rules, comments, votes, and membership in durable application state. Keeping ballots behind the service also permits hidden results and exact vote-allowance enforcement without distributing all ballots to browsers.

### Suggested storage contract

Use records equivalent to `users`, `sessions`, `boards`, `board_members`, `board_documents`, `document_updates`, `document_snapshots`, `board_assets`, `comments`, `workshop_sessions`, `ballots`, and `canvas_operations`. The storage technology must support the required transactions and unique constraints. A relational database is a straightforward implementation; binary Yjs updates can live alongside metadata for the initial scale.

Key invariants are board/document ownership, one effective membership per user/board, an atomic owner transfer, unique `(board_id, actor_id, request_id)` operation keys, and vote spending within the allowance. Require a recoverable relationship between snapshots, subsequent updates and the asset manifest. Define backup retention and recovery objectives before the internal pilot.

## Architectural patterns

### 1. Server-authorized documents with local pending work

Retain local responsiveness and a clearly labeled pending cache, while the server becomes the canonical durable copy. Distinguish `local pending`, `uploading`, `saved to server`, `offline`, and `save failed`. A connected socket or provider sync event alone does not establish that both document updates and uploaded images are durable. The transport needs explicit persistence receipts whose semantics are tested during restart and storage-failure scenarios. [S2–S3, S7]

Namespace browser caches by authenticated identity and board. On logout, clear in-memory documents and the chosen persistent cache according to the agreed shared-device policy. Revocation prevents future server reads/writes; handling already cached content requires an explicit product policy. Reconnect rechecks current permissions before uploading pending work.

### 2. One authorization policy across HTTP, assets, WebSocket and MCP

```typescript
// Proposed Dali application contract; not a BlockSuite API.
type BoardRole = 'owner' | 'editor' | 'viewer';
type CanvasAction = 'read' | 'edit' | 'manageAccess';

function permits(role: BoardRole, action: CanvasAction): boolean {
  if (action === 'read') return true;
  if (action === 'edit') return role === 'owner' || role === 'editor';
  return role === 'owner';
}

async function authorizeDocument(actorId: string, documentId: string) {
  const boardId = await documentOwnership.requireBoard(documentId);
  const role = await boardMembership.requireRole(actorId, boardId);
  return { boardId, canWrite: permits(role, 'edit') };
}
```

Apply the policy when opening a room and when accepting mutations. Revoke or downgrade open connections when membership changes. Validate socket origin and session expiry, and reject unknown document IDs. Viewer read access may coexist with presence messages; presence must never grant document write capability. Comments and facilitation permissions need additional explicit actions once requirements resolve them.

Recommend an Okta OIDC authorization-code flow handled by the backend, using a maintained OIDC library, validated state/nonce and token claims, then a secure HTTP-only Dali session. Validate the configured issuer, signature, audience and expiry; keep credentials in the backend. [S10–S11] Okta's organization issuer supports login, while custom authorization server availability is a separate tenant decision; org-server access tokens are intended for Okta resources. Treat MCP token issuance as a separate authorization compatibility spike. [S12]

### 3. Semantic commands producing native editable objects

Introduce a Dali canvas command contract with board ID, schema version, request ID, placement, nodes and edges. Validate node counts, string lengths, allowed types, finite coordinates, graph references and mind-map acyclicity before mutation. Convert through a single pinned canvas adapter, preserving stable element IDs and grouping one generated result into a useful undo unit. Existing upstream templates provide a starting seam for native object creation. [S5]

```typescript
// Proposed command boundary. Concrete adapter implementation requires spike A4.
type CreateDiagram = {
  boardId: string;
  requestId: string;
  schemaVersion: 1;
  nodes: Array<{ key: string; label: string; kind: 'process' | 'decision' }>;
  edges: Array<{ from: string; to: string; label?: string }>;
};

async function createDiagram(actor: Actor, raw: unknown) {
  const command = diagramSchema.parse(raw);
  await boardPolicy.require(actor, command.boardId, 'edit');
  return canvasOperations.applyOnce(actor.id, command, async document => {
    const layout = layoutDiagram(command);
    return canvasAdapter.createEditableDiagram(document, layout);
  });
}
```

`applyOnce` must atomically record the durable update and operation result before success. Serialize initial server-side command execution per board, or use equivalent transactional conflict handling. A retry after a lost response returns the same created IDs. Duplicate request keys with different payloads fail. A Yjs transaction groups changes but the database/operation ledger must provide crash-safe idempotency.

MCP should expose bounded tools such as `list_boards`, `create_diagram`, and `create_mind_map`, with schema-validated structured results containing the board URL, operation ID and created object IDs. These are proposed Dali tools. Keep `boardId` explicit on mutation requests. The 2026-07-28 protocol carries metadata per request and retires protocol sessions; use the SDK's versioned implementation rather than recreating message handling. [S13–S15]

Authenticate each MCP request, validate tokens for the Dali resource, and apply both scope and board policy. Confirm the actual agent client's supported protocol and authorization flow. MCP's resource metadata and issuer validation requirements make an existing browser login insufficient evidence of MCP interoperability. [S16]

### 4. Stable semantics with derived layout

For mind maps, persist hierarchy and text; treat branch coordinates as a deterministic layout result. Decide whether layout coordinates are locally derived or shared through one designated writer, because several clients writing competing layouts can generate continuous movement. Personal collapse state should not continuously rewrite shared coordinates. Confirm that the pinned native model can meet keyboard, collapse and collaboration requirements before wrapping it.

For Gantt, persist calendar dates, row order and labels; derive bars from calendar range and zoom. Choose date-only semantics and timezone handling explicitly. For diagrams, connectors retain native node references so they continue tracking moved objects. Do not reduce domain semantics to disconnected rectangles if later editing requires preserving graph or date relationships.

## Key data flows

1. **Open board:** Login establishes Dali session → board service returns authorized metadata → client starts selected board adapter → collaboration service maps all required document IDs to that board → durable state loads before creation defaults run → authorized blob references resolve → canvas becomes ready.
2. **Edit and recover:** Local canvas mutation → pending cache and outbound update → server rechecks write permission → update durably appends → server broadcasts/acknowledges according to the defined receipt contract → clients converge. Reconnect fetches server differences before exchanging remaining authorized work.
3. **Upload image:** Editor requests upload → server verifies board role and limits → bytes become durable → manifest receipt returns → document references the asset → save state waits for both durable components. Failed uploads remain retryable and visibly incomplete.
4. **Vote:** Facilitator opens a configured session with eligible object IDs → participants submit ballots → server transaction checks identity, eligibility, session status and allowance → clients receive allowed status → results publish at reveal. Deleted objects remain identifiable in historical results.
5. **Follow Me:** Authorized presenter session identifies broadcaster → awareness publishes viewport with sequence/time metadata → followers opt in and apply it locally → disconnect expires presence and releases following without modifying board content.
6. **Agent creation:** MCP request supplies target and graph → authorization and schema checks → idempotent operation loads current board → canvas adapter creates native content → durable operation commits → active users receive updates → response returns object IDs. Creation must work when no human browser is open.

## Recommended project structure

```text
src/                         # extend upstream frontend incrementally
├── boards/                  # server-backed board library and preferences
├── canvas/                  # pinned BlockSuite adapter and lifecycle
├── collaboration/           # transport, receipts, presence and follow
├── workshops/               # comments, voting, timers
└── auth/                    # session-aware UI
server/
├── identity/                # OIDC callback and sessions
├── boards/                  # directory, memberships, resource ownership
├── collaboration/           # rooms and durable document updates
├── assets/                  # authorized manifests and bytes
├── workshops/               # transactional session state
├── canvas-operations/       # native generation and idempotency
└── mcp/                     # protocol adapter
shared/
├── contracts/               # schemas, command and response types
└── canvas-model/            # semantic graphs, dates, layout inputs
```

Start with these module boundaries in the existing project rather than requiring a monorepo conversion. Extract shared packages only if separate builds or server-safe imports make them useful. Keep DOM/view imports away from the headless command path until proven compatible.

## Acceptance spikes and build dependencies

| Spike | Concrete acceptance evidence | Downstream dependency |
|---|---|---|
| A1 — Pinned workspace lifecycle and document mapping | Inventory exact 0.22.4 types; trace metadata/root/board documents and awareness. Two clean browser profiles open the same board, modify native text and connectors, reload, and recover all objects. A second private board's metadata/content never appears on the unauthorized client's network. | Shared persistence and secure collaboration |
| A2 — Durable documents and assets | Modify content and upload an image; record server receipt; terminate service; open in a fresh browser profile; verify text and image bytes. Inject document-store and blob-store failures; verify honest save status and recoverability. Restore a snapshot plus subsequent updates and asset manifest. | Internal pilot and export trust |
| A3 — Access enforcement and revocation | Exercise owner/editor/viewer through direct HTTP, asset routes and crafted WebSocket sync/update messages. Downgrade an active editor, expire a session, and reconnect with queued writes; all unauthorized mutations are rejected. Unit tests use synthetic identities; a staging Okta login separately verifies actual claims. | Every shared feature |
| A4 — Editable generation without an open browser | In a server process load the pinned store, create two connected shapes and a hierarchical mind map, persist, then open in browser. Edit text, move a node, add child/sibling, collapse/expand and undo. Retry same request across an injected crash and verify one result. If DOM imports prevent this, evaluate a controlled browser worker and document operational cost before choosing it. | MCP and advanced templates |
| A5 — Concurrent mind-map semantics | Three participants add siblings, rename nodes, reparent and collapse branches while reconnecting. Define deletion/reparent conflicts, validate tree invariants and compare resulting content/geometry. Confirm personal versus shared collapse behavior with requirements. | Daily-use mind maps |
| A6 — Workshop invariants | Concurrent ballots cannot exceed allowance; unrevealed ballots/results cannot be recovered from participant payloads; reconnect preserves eligible IDs and allowances. Timer survives service/client restart; presenter departure stops following cleanly. | Facilitation |
| A7 — Actual MCP client compatibility | Using the selected client, discover tools, authenticate to a staging Dali resource, create content in an explicit board, and reject wrong audience/scope/board role. Record protocol and SDK versions; prove browser login and MCP access separately. | Agent rollout |

Suggested sequence: incorporate and validate upstream → board/session/authorization foundation → durable document and asset path → real-time collaboration → daily mind maps → facilitation → expanded native templates/diagrams/Gantt → MCP rollout. Run A4 early enough to reveal model limitations while delivering MCP after persistence and authorization are sound. Fine-grained roadmap phases can separate each capability within this dependency chain. Plane stays deferred; reserve stable board/object IDs as future integration anchors.

## Scaling and operational considerations

| Workload | Initial approach | Evidence triggering expansion |
|---|---|---|
| Three-to-five-person session | One authoritative collaboration process with bounded per-board memory and update sizes | Measure convergence delay, reconnect time and memory on realistic team boards. |
| More concurrent boards | Room lifecycle/eviction, snapshot compaction, bounded thumbnails and uploads | Rising active-room memory or replay time; add capacity only against measurements. |
| Multiple collaboration instances | Deliberate room ownership or a proven shared-update transport, plus consistent ACL invalidation | Availability/capacity targets require multiple instances; verify reconnect and duplicate delivery. |
| Large images and boards | Image size limits, thumbnails, viewport-aware rendering and export limits | Browser memory, rendering latency or export failures under agreed fixtures. |

Do not infer a total-user capacity from the session-size requirement. Collect open-board time, edit propagation latency, pending-update age, failed asset uploads, recovery success, room memory and authorization denials. Define numeric pilot thresholds with realistic fixtures before calling performance acceptable. Yjs documents describe several scaling patterns; those are implementation choices once workload evidence justifies them. [S7]

## Failure-prone architecture choices

| Choice to avoid | Consequence | Recommended approach |
|---|---|---|
| One globally synchronized board catalog | Private metadata can reach clients before UI filtering. | Server-filtered board library and board-isolated namespace. |
| Read-only toolbar as viewer enforcement | Direct protocol messages can still mutate server state. | Server checks all mutation-bearing paths. |
| Shared CRDT ballots and mutable ACL fields | Participants can inspect hidden ballots or forge constrained state. | Transactional service ownership and authorized projections. |
| Two full editable models with bidirectional synchronization | Canvas and domain representations drift and create conflicting ownership. | One semantic owner per field; deterministic projections. |
| Declaring saved at WebSocket connection or local IndexedDB completion | Reopening on another machine can lose content/assets. | Durable document and blob receipts with recovery tests. |
| AI writes undocumented binary document structures | Upgrades and partial operations can corrupt editable behavior. | Schema-validated commands through pinned native adapters. |
| MCP depends on whichever browser tab is active | Agent actions target ambiguous boards and fail when browsers close. | Explicit target and server-executable operation path. |

## Sources

- **S1 — DJAI Academy package manifest:** [https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/package.json](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/package.json) (dependency versions; read from matching local checkout).
- **S2 — DJAI workspace implementation:** [https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/workspace.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/workspace.ts) (source adapters, initialization and persistence lifecycle).
- **S3 — DJAI board catalog:** [https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/boards/catalog.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/boards/catalog.ts) (browser-local board index).
- **S4 — DJAI extension registry:** [https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/extensions.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/extensions.ts) (explicit store/view feature composition).
- **S5 — DJAI template creation:** [https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/boards/templates.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/boards/templates.ts) (native primitive creation seam).
- **S6 — BlockSuite store guide:** [https://blocksuite.io/guide/store](https://blocksuite.io/guide/store) (Yjs/store concepts; API examples differ from pinned application).
- **S7 — Yjs WebSocket provider:** [https://docs.yjs.dev/ecosystem/connection-provider/y-websocket](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket) (central transport, persistence and scaling patterns; runtime commands require version revalidation).
- **S8 — Yjs subdocuments:** [https://docs.yjs.dev/api/subdocuments](https://docs.yjs.dev/api/subdocuments) (provider-specific subdocument loading and synchronization).
- **S9 — Yjs awareness:** [https://docs.yjs.dev/getting-started/adding-awareness](https://docs.yjs.dev/getting-started/adding-awareness) (ephemeral participant state).
- **S10 — Okta authorization code:** [https://developer.okta.com/docs/guides/implement-grant-type/authcode/main/](https://developer.okta.com/docs/guides/implement-grant-type/authcode/main/) (web application login).
- **S11 — Okta ID-token validation:** [https://developer.okta.com/docs/guides/validate-id-tokens/main/](https://developer.okta.com/docs/guides/validate-id-tokens/main/) (identity validation).
- **S12 — Okta authorization servers:** [https://developer.okta.com/docs/concepts/auth-servers/](https://developer.okta.com/docs/concepts/auth-servers/) (org versus custom issuer applicability).
- **S13 — MCP 2026-07-28 release:** [https://blog.modelcontextprotocol.io/posts/2026-07-28/](https://blog.modelcontextprotocol.io/posts/2026-07-28/) (protocol lifecycle changes).
- **S14 — MCP TypeScript SDK v2:** [https://ts.sdk.modelcontextprotocol.io/v2/](https://ts.sdk.modelcontextprotocol.io/v2/) (stable SDK line and protocol support).
- **S15 — MCP tools specification:** [https://modelcontextprotocol.io/specification/2026-07-28/server/tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) (tool contracts and structured input/output).
- **S16 — MCP authorization specification:** [https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) (resource-scoped authorization and issuer validation).

All web sources were accessed on 2026-09-11. Undated guides are treated as current retrieved documentation, with exact implementation compatibility still subject to version-specific spikes.
