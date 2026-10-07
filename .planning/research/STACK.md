# Stack Research — Dali

**Domain:** Self-hosted collaborative product and engineering canvas  
**Researched:** 2026-09-11  
**Confidence:** MEDIUM; source and lockfile inspection plus official documentation, with integration spikes outstanding.

## Recommendation

Preserve DJAI Open Canvas's React/TypeScript/BlockSuite editing foundation. Add a small TypeScript service for Okta sessions, board authorization, durable Yjs synchronization, asset access, and MCP commands. Use PostgreSQL for board metadata, access grants, durable document updates and facilitation records, with an asset-storage adapter backed by the operator's chosen durable storage. Start with one synchronization process; introduce distributed coordination only when measured concurrency requires it. This is a proposed design for Dali's stated three-to-five-person sessions, rather than a measured capacity result. Product scope comes from [PROJECT.md](../PROJECT.md) (agreed workflows, constraints, and unresolved requirements).

The first engineering phase should reproduce the exact upstream baseline, verify mind-map extension feasibility, and prove one durable, authorized collaborative board. Keep the BlockSuite release family aligned at 0.22.4 initially. Upgrade the inherited build tool separately because its locked Vite release is outside current support. Avoid coupling the initial application work to a wholesale editor replacement or the AFFiNE application backend.

## Evidence Boundary and Local Baseline

Read-only inspection covered upstream commit `27f8bb97b10984e04e48d7650d954d0a7ecd212c`, with a clean Git status at inspection. The checkout has **no node_modules directory**. Versions below are lockfile resolutions; installed-package contents, successful builds, browser behavior, collaboration and production suitability were not validated.

Local sources:

- [package.json](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/package.json) (declared dependencies and verification commands).
- [package-lock.json](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/package-lock.json) (exact resolutions and declared package licenses).
- [extensions.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/extensions.ts) (explicit store/view extension registration).
- [workspace.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/workspace.ts) (TestWorkspace, document/blob persistence, startup and teardown).
- [vite.config.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/vite.config.ts) (decorator transforms, dependency optimization and vanilla-extract configuration).
- [catalog.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/boards/catalog.ts) (browser-local board catalog).
- [image-visual-edits.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/src/canvas/image-visual-edits.ts) (existing custom schema and view extension example).
- [community.spec.ts](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/tests/community.spec.ts) (existing browser verification coverage to retain and inspect).

### Locked Technologies to Preserve for Baseline Reproduction

| Technology | Exact lockfile resolution | Role and decision |
|---|---|---|
| React / React DOM | 18.3.1 / 18.3.1 | Retain application shell and React-to-web-component integration. |
| TypeScript | 5.9.3 | Retain strict compile-time integration checks. Manifest range starts at 5.6.3; using that minimum would change the inspected baseline. |
| BlockSuite editor/store/sync/gfx family | 0.22.4 | Retain exact alignment across packages; isolate editor-specific APIs behind a Dali adapter. |
| Yjs | 13.6.31 | Retain underlying CRDT generation and ensure one resolved Yjs runtime across editor and provider. |
| y-protocols / lib0 | 1.0.7 / 0.2.117 | Existing transitive protocol/utilities; verify deduplication when introducing sync dependencies. |
| Vite | 5.4.21 | Reproduce baseline, then move to a supported release in an isolated compatibility change. |
| @vitejs/plugin-react | 4.7.0 | Preserve paired baseline; select compatible release when Vite changes. |
| @vanilla-extract/vite-plugin | 4.0.19 | Preserve BlockSuite CSS compilation behavior. |
| @preact/signals-core | 1.14.4 | Preserve reactive integration already used by the canvas. |
| pdf-lib | 1.17.1 | Retain existing PDF export implementation pending scope and browser fidelity tests. |
| Vitest / Playwright | 2.1.9 / 1.62.1 | Retain existing tests for baseline; update runner compatibility with the build-tool change. |

All rows are directly evidenced by the local lockfile. They are baseline choices, not claims that these are the latest releases.

### Additions and Supported Build Target

| Technology | Recommended release line | Purpose and rationale | Validation required |
|---|---|---|---|
| Node.js | 24 LTS; pin current patch and image digest during implementation | Shared TypeScript backend runtime with a supported production lifecycle. Node's current table lists 24 and 22 as LTS and 26 as Current. [Node.js releases](https://nodejs.org/en/about/previous-releases). | Build inherited frontend and backend on the selected patch; preserve a reproducible CI image. |
| Fastify | 5.x; exact patch unselected | Small HTTP API, auth/session boundary and WebSocket upgrade integration; keeps the service in the existing language. Current LTS documentation lists the 5.x line. [Fastify LTS](https://fastify.dev/docs/latest/Reference/LTS/). | Choose matching plugin majors; verify Node 24 support in chosen releases and exercise request validation. |
| PostgreSQL | 17.x current maintenance release; 18.x acceptable if operator standard | One durable store for relational access records, idempotency receipts, comments/votes and binary CRDT updates. The official policy lists both majors as supported. Prefer the operator's maintained major over introducing a second database engine. [PostgreSQL versioning](https://www.postgresql.org/support/versioning/). | Pin available patch/image; perform backup and restore, migrations and crash-recovery checks. |
| y-websocket-compatible transport | Stable `y-websocket` generation compatible with Yjs 13; exact version requires spike | Reuse Yjs wire synchronization and awareness with server-side board checks and persistence. Implement a BlockSuite 0.22.4 source adapter or a narrowly scoped bridge, based on actual package interfaces. [Yjs provider docs](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket). | Prove per-document routing, awareness integration, durable acknowledgments and revocation. |
| openid-client | 6.x; exact patch unselected | Server-side OIDC discovery and authorization-code handling with PKCE; documented ESM support and Node 20+ baseline suit the proposed Node runtime. [openid-client](https://github.com/panva/openid-client). | Tenant issuer, client registration, callback/logout, session renewal and group mapping. |
| MCP TypeScript SDK | Stable v2 `@modelcontextprotocol/server`; framework adapter as needed | Current official repository says v2 is stable alongside the 2026-07-28 specification; supports Streamable HTTP, stdio and auth helpers. Use current split packages for the new service. [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). | Pin actual stable patch; negotiate protocol and authorization with the chosen agent client. |
| Vite migration target | 7.3.x initial supported target; exact patch unselected | Current Vite policy gives 7.3 important fixes/security maintenance. This proposed target keeps the upgrade smaller than adopting 8.3 immediately. [Vite releases](https://vite.dev/releases). | Preserve decorators, class-field semantics, vanilla-extract CSS, startup ordering, development and production builds. |

New-package patch versions have deliberately not been invented: no registry resolution or install was performed. Resolve, check provenance/license, and lock exact patches during the relevant phase. The Vite target is a compatibility hypothesis, not a proven working combination. If its support status changes before implementation, reselect from the current support table.

## BlockSuite Extension and Persistence Findings

### Mind Maps

The lockfile already contains `@blocksuite/affine-gfx-mindmap@0.22.4`. The active extension lists register shapes, connectors, groups, text, frames, notes and other primitives, but omit mind-map registrations. Consequently, **the cheapest credible first spike is to expose the matching native mind-map store/view extensions**, inspect their model, commands, keyboard behavior and layout hooks, and add only the Dali behavior gaps.

This inspection does not establish that 0.22.4 supports every requested interaction. Keyboard child/sibling creation, persistent collapse, descendant-count badges, automatic reflow, collaborative reparenting and export of collapsed branches all require package-source inspection and browser tests. Package contents could not be fetched through available registry/CDN access, so exact export names and capability claims remain unresolved. Do not write feature acceptance around guessed symbols.

If native collapse is incomplete, retain stable node IDs, parent-child structure and rich text in the same BlockSuite document, then introduce a narrowly scoped view/model extension after choosing whether collapse is shared or personal. Build a second mind-map renderer only if the spike demonstrates a concrete native-model limitation; it would add selection, clipboard, zoom, undo and serialization integration work. This is a design recommendation inferred from the existing extension system, not an upstream guarantee.

### Persistence and Source Interfaces

The application constructs `TestWorkspace` from `@blocksuite/affine/store/test`, supplies IndexedDB document and blob sources, starts synchronization, waits for restoration, then initializes metadata. It already contains defensive handling for failed writes, timeouts, failed blob retries and disposal. Its database name is `djai-storyboard`. A separate board catalog lives in localStorage. These implementation facts are evidenced in the local sources above.

Preserve this initialization ordering while isolating the test-path dependency. The proposed production adapter must explicitly own document loading, server authorization, asset loading, persisted-state confirmation and teardown. Inspect the 0.22.4 `DocSource`/blob/awareness interfaces before selecting how a remote source plugs in; use the published source interfaces where possible. Generic examples written for older `DocCollection` APIs are conceptual references only. [BlockSuite synchronization guide](https://blocksuite.io/guide/data-synchronization) (older framework documentation).

Use server metadata as the authority for accessible boards. Treat browser persistence as a cache whose keys are scoped by authenticated identity and board, with defined sign-out/revocation behavior. A server-backed document source and blob source must be introduced together: a remotely restored board with browser-only image blobs is incomplete. Define whether a save indicator means locally recorded or durably stored on the server.

### Real-Time Transport Choice

Use the stable Yjs 13 ecosystem first. The current y-websocket repository explicitly describes `@y/websocket` plus Yjs 14 as an unstable development line and recommends stable `y-websocket` for most users. Its server implementation has moved to a separate package; avoid copying old `node_modules/y-websocket/bin/server.js` startup instructions. [y-websocket repository](https://github.com/yjs/y-websocket).

Dali needs an application server around that transport: authorize room joins and every incoming document mutation, distinguish read-only subscriptions, reject writes after revocation, and persist accepted updates with explicit recovery semantics. Keep shared workspace metadata out of user-editable ACL storage. Add board limits and bounded protocol messages. Start with one writer/coordinator per active board and a durable update log plus periodic snapshots; use a shared process registry before considering multi-replica routing. These are Dali design requirements, not bundled y-websocket features.

## Okta and MCP Integration

Use Okta-hosted sign-in with OIDC Authorization Code + PKCE and a Dali server session held by a secure, HttpOnly cookie. Keep refresh credentials server-side. Resolve membership from the approved issuer, subject and configured claims; apply owner/editor/viewer grants inside Dali. A group may allow application entry without implicitly granting every board. Validate Origin on WebSocket handshakes and enforce CSRF protection on cookie-authenticated mutations. The server-session design is a recommendation; operator-managed tenant registration is pending. [Okta web-app redirect guide](https://developer.okta.com/docs/guides/sign-into-web-app-redirect/node-express/main/), [Okta PKCE guide](https://developer.okta.com/docs/guides/implement-grant-type/authcodepkce/main/).

Okta documents production API Access Management as an optional add-on required for custom authorization servers. Confirm that entitlement and issuer capabilities before assuming existing SSO can issue audience-restricted tokens for Dali's MCP endpoint. Successful browser login alone does not establish MCP client registration and resource-token compatibility. [Okta PKCE guide](https://developer.okta.com/docs/guides/implement-grant-type/authcodepkce/main/).

Expose MCP over authenticated Streamable HTTP. Its tools should validate a versioned diagram/mind-map command schema, require an explicit board ID, resolve the caller's current grant, and invoke the same Dali command service used by human editing. Give commands idempotency keys and return created object IDs plus actual persistence status. Generate native editable objects, and validate with no browser attached as well as a concurrent editor. A headless BlockSuite adapter is a required spike because the current frontend imports view packages and raw TypeScript.

Implement current MCP protected-resource discovery, resource-scoped token validation and per-request authorization. Verify the chosen client and Okta issuer together, including registration, expiry and denied scopes. The 2026-07-28 authorization specification permits pre-registration among its registration mechanisms and describes protected-resource metadata. [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

## Supporting Choices and Alternatives

| Area | Preferred approach | Alternative trigger |
|---|---|---|
| Asset storage | Adapter with board-scoped upload/download authorization; use the operator's existing durable object store, or a backed-up persistent filesystem for the first single-host deployment. | Select an S3-compatible SDK and product only after infrastructure requirements and licensing are known. |
| Database access | Small PostgreSQL repository layer with explicit migrations and transactions. | Adopt an ORM if the operator already standardizes one; no ORM decision is necessary to prove sync. |
| Schema validation | One shared command schema reused by API and MCP; select the validation library with SDK compatibility. | SDK v2 supports Standard Schema, including Zod 4; exact dependency choice belongs to the MCP phase. [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk). |
| Synchronization service | Narrow Yjs/BlockSuite adapter and an application-owned authorization boundary. | Evaluate Hocuspocus or another maintained compatible backend if the source-adapter spike exposes substantial protocol work; prove its exact persistence, read-only and revocation behavior first. |
| Rendering | BlockSuite native primitives, including native mind-map candidate. | Another renderer is a deliberate foundation decision requiring migration and interaction evidence. |
| Diagrams | Native element templates and typed creation commands for sequence, C4 and swimlanes. | Add a layout engine only when representative graphs show native or deterministic application layouts are insufficient. |
| Gantt | Date-bearing task records with native editable canvas rendering and deterministic date-to-position mapping. | Evaluate a specialized chart only if calendar interaction demands exceed canvas extension feasibility. |
| Deployment | Static frontend plus one service and durable database/storage, using the operator's established reverse proxy and secret management. | Multiple service replicas require board routing, invalidation and shared presence design. |

Deferred dependency choices include a layout engine, icon library, ORM and object-store vendor. No evidence from this task requires adding all of them to the initial installation.

## License and Attribution Boundary

The local DJAI source license and Dali license declare MIT. Preserve DJAI copyright and permission notices when incorporating source. The 0.22.4 lockfile labels the inspected BlockSuite packages MIT. The older standalone [BlockSuite repository](https://github.com/toeverything/blocksuite) advertises MPL-2.0, while the current [AFFiNE root license](https://github.com/toeverything/AFFiNE/blob/canary/LICENSE) identifies MIT coverage outside specified backend/native and third-party exceptions. These sources cover different artifacts and scopes.

Before distributing Dali, inspect the **actual selected package tarballs and corresponding source licenses**, including bundled fonts/icons and copied assets, and generate third-party notices from the final lockfile. Retain Dali's own MIT license while preserving dependency-specific notices. Lockfile metadata supports selection but does not complete the distribution audit. Copying AFFiNE backend/native code requires separate license review under its referenced terms; this stack proposal does not depend on copying that backend. Exact tarball verification remains an open gate because package retrieval failed in this research environment. [DJAI LICENSE](https://github.com/DJAI-Academy/djai-open-canvas/blob/27f8bb97b10984e04e48d7650d954d0a7ecd212c/LICENSE) (upstream MIT notice), [Dali LICENSE](../../LICENSE) (project MIT notice).

## Concrete Validation Spikes and Exit Evidence

| Order | Spike | Required evidence to proceed |
|---|---|---|
| 1 | Reproduce upstream and inventory licenses | Exact locked install in Dali's implementation checkout; typecheck, build, unit/browser suites; notice inventory and immutable upstream provenance. |
| 2 | Mind-map extension at 0.22.4 | Source/export inventory; child and sibling keyboard creation; 100-node representative map as a provisional fixture; collapse/reopen without lost descendants; undo, reload, PNG export and auto-layout evidence. Agree a larger board budget later. |
| 3 | Authorized durable collaboration | Three independent browser contexts then five participants; concurrent edits, offline/rejoin, separate viewer denial, revoked editor denial, server restart, database restore and all images visible on a clean browser. |
| 4 | Supported build-tool migration | Development and built production route work on selected Node/Vite versions; all existing canvas/export fixtures pass; inspect decorator and CSS output. |
| 5 | Okta tenant integration | Approved issuer/client metadata, valid sign-in, wrong issuer denied, expiry/logout behavior, member removal and per-board ACL tests. Record only synthetic configuration examples in the public repository; keep all real tenant settings in the operator-managed environment. |
| 6 | Headless MCP edits | Chosen MCP client creates a diagram and mind map into an explicitly authorized board with browser closed; reload finds editable objects; retry does not duplicate; concurrent human edit converges; viewer and revoked-token calls fail. |

These are proposed phase checks; none ran during research. Early spikes may be sequenced within small phases, following the project's delivery preference. Prioritize editor/mind-map and synchronization uncertainty before expanding template libraries and facilitation features.

## Installation and Verification Handoff

No dependencies were installed. During an authorized implementation phase, incorporate upstream source and lockfile with attribution, then run baseline commands in Dali:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:browser
```

Inspect scripts and install hooks before executing. Add backend dependencies in their own package with exact chosen versions. Use the existing package manager and lockfile convention. Do not combine foundational BlockSuite, React, build-tool and synchronization upgrades into one unisolatable change.

## Research Method, Confidence and Remaining Gaps

The GSD runtime identified itself as `@opengsd/gsd-core` 1.13.0. Its research-plan seam selected Context7 for library questions and websearch for Okta. Context7 tools and `ctx7` CLI were unavailable, so official websites/repositories were consulted through the web tool. `classify-confidence --provider websearch --verified` returned **MEDIUM**, used for cached cross-checked research digests and this report. Local lockfile/source facts are direct observations; proposed integration compatibility remains unproven.

Remaining gaps: exact 0.22.4 mind-map exports and behaviors; package artifact license verification; production replacement/isolation of TestWorkspace; remote source and awareness integration; durable acknowledgment contract; operator-managed hosting and total board-volume expectations; selected new-package patches; Okta tenant claims/entitlements and chosen MCP client interoperability. Current web pages are living sources, not immutable release snapshots; recheck them when pinning implementation dependencies.
