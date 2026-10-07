# Project Research Summary

**Project:** Dali
**Domain:** Self-hosted collaborative product-planning and technical-design canvas
**Researched:** 2026-09-11
**Confidence:** MEDIUM — source-backed direction; runtime integration remains unvalidated.

## Scope Update After Research

During requirements review, the user clarified that concurrency must have no product-enforced participant cap and should be validated with 20 simultaneous users on a canvas. Earlier three-to-five-person references below describe the original research workload only. User comments must attach to specific canvas entities, and image export must support a selected group of shapes.

The user subsequently confirmed that roadmap composition and Gantt belong in the initial release, while MCP creation is deferred. Roadmaps use ordinary canvas shapes arranged manually or through templates; Gantt is a widget accepting tasks and dates and rendering the visual. Treat the phase suggestions and feature classifications below as the original research proposal: fold roadmap compositions into template coverage when allocating requirements, retain the dedicated Gantt capability, and place MCP outside the initial-release roadmap. PROJECT.md contains the current authoritative scope.

## Executive Summary

Dali extends DJAI Open Canvas for the operator's internal ideation, mind mapping, workshops, and technical design. Preserve its React/TypeScript/BlockSuite foundation and add a modular TypeScript backend for Okta sessions, per-board permissions, durable documents/assets, collaboration, and agent commands. Scope follows [PROJECT.md](../PROJECT.md) (agreed workflows and exclusions); the replacement decision should be judged against those workflows. Mind maps deserve the first specialty capability and an immediate compatibility proof.

The strongest shared recommendation is one isolated board namespace, one server-owned access policy, and one semantic owner for each kind of state. Keep editable canvas content in BlockSuite/Yjs, constrained workshop actions in transactional backend records, and cursors/viewports in ephemeral awareness. Start with a single collaboration service on operator-managed infrastructure, measuring the requested three-to-five-person sessions before adding distributed infrastructure. Deliver small sequential capability phases, using independent parallel tasks within each phase.

The principal risks are unauthorized direct updates, incomplete document/image recovery, conflicting tree layout or undo behavior, and duplicated agent operations. Address these through direct-path role tests, restart/cold-browser recovery, concurrent semantic invariant checks, and durable command idempotency. The research inspected upstream source and official documentation; no dependencies were installed and no build, browser, Okta, collaboration, or MCP integration passed runtime validation. Recommended new versions remain candidates pending compatibility checks.

## Key Findings

### Recommended Stack

See [STACK.md](STACK.md) (locked baseline, proposed additions, version and license gates).

- Preserve the inspected baseline: React 18.3.1, TypeScript 5.9.3, aligned BlockSuite 0.22.4 packages, and Yjs 13.6.31. These are lockfile resolutions.
- Propose Node 24 LTS, Fastify 5.x, PostgreSQL 17.x or the operator's maintained 18.x, and a private durable asset adapter. Resolve exact patches and deployment products during implementation.
- Propose a stable Yjs-13-compatible WebSocket transport behind Dali authorization and persistence. Inspect exact BlockSuite document/blob/subdocument interfaces before selecting its adapter.
- Reproduce inherited Vite 5.4.21, then validate a supported build-tool upgrade independently. Vite 7.3.x is the research candidate; decorator/CSS/plugin compatibility and support status need rechecking.
- Propose server-side OIDC with PKCE and secure Dali sessions; evaluate openid-client 6.x. Okta tenant registration, issuer, claims and MCP token issuance require separate validation.
- Propose MCP TypeScript SDK v2 and authenticated HTTP after native headless creation works. Pin SDK, protocol revision and client compatibility together.

### Expected Features

See [FEATURES.md](FEATURES.md) (source-labeled capability matrix and acceptance candidates).

**Must have:** Durable editable canvas and images; Okta; owner/editor/viewer board access; accessible-board library; three-to-five-person collaboration; keyboard mind maps with collapse and automatic layout; Follow Me; comments; timer; voting; requested templates/mockups and technical palettes; visual roadmaps; manual date-driven Gantt; image export; editable MCP generation.

**Differentiators within scope:** organization-neutral reusable workshops, immediate human refinement of agent-created native diagrams, and daily mind maps alongside technical solution design. These are adoption hypotheses rather than measured benefits.

**Deferred or excluded:** Plane integration is deferred; ClickUp imports are excluded. Initial migration uses exported Miro images. External guests, editable Miro migration, slide presentation, video integrations, general spreadsheets, and broad Miro parity remain outside initial scope. PDF's upstream implementation does not settle Dali's export requirements.

### Architecture Approach

See [ARCHITECTURE.md](ARCHITECTURE.md) (component boundaries, state ownership and executable acceptance spikes).

1. **Canvas adapter:** Isolate pinned editor imports, workspace lifecycle, semantic models, native commands and export; investigate the already-locked but unregistered mind-map package first.
2. **Identity and board service:** Own sessions, board directory, membership and subordinate-resource mapping; return only authorized board metadata.
3. **Collaboration and assets:** Check room reads and incoming writes, persist updates/snapshots and blobs, issue explicit durable receipts, and recheck access on reconnect/revocation.
4. **Workshop service:** Own comments, ballots, allowances, reveal state and timer deadlines; distribute only authorized state projections.
5. **Native command executor and MCP adapter:** Validate bounded graphs, target board and current authority; commit durable operation results and return stable object IDs, including when no browser is open.

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) (risk evidence, prevention and concrete test oracles).

1. **Permission bypass:** Centralize policy across HTTP, sync, assets and MCP; test crafted viewer updates and active-editor revocation.
2. **False durable-save status:** Couple document and asset receipts; prove service restart, cache-free reopen and backup restoration with content/asset comparisons.
3. **Invalid collaborative trees and undo:** Define transaction origins, parentage/conflict rules, collapse ownership and deterministic layout; verify preserved descendants and settled update traffic.
4. **Broken workshop rules:** Use transactional vote spending, deduplicated requests and authoritative deadlines; test close races, late joins and pre-reveal payloads.
5. **Partial or duplicate generated content:** Validate the full graph, bind request keys to actor/board/payload, and persist recoverable operation results; inject crashes before and after acknowledgement.

## Implications for Roadmap

The following capability phases are recommendations for requirements allocation, not approved implementation plans. Each phase carries its feature-specific export/reload checks. Team rollout requires the access, recovery and collaboration gates.

### Phase 1: Validated Canvas Foundation
**Rationale / delivers:** Incorporate the exact upstream baseline with attribution; reproduce build/tests and core editing, images and export; isolate the editor adapter. Run an early native mind-map feasibility spike and a minimal server-safe creation probe.
**Addresses / avoids:** Existing canvas workflows; prevents guessed extension APIs, lifecycle regressions and late discovery of editor limitations. Keep dependency migration as a separate verified task.

### Phase 2: Daily Mind Maps
**Rationale / delivers:** Prioritize the daily-use specialty after the extension proof: keyboard child/sibling creation, styled text, collapse/expand, badges if specified, automatic layout and undo.
**Addresses / avoids:** Complete local mind-map behavior with stable semantic IDs; choose collapse ownership before schema commitment. Verify reload/export and preserve hidden descendants; collaborative acceptance follows in Phase 5.

### Phase 3: Okta and Board Access
**Rationale / delivers:** Establish authenticated board identities before exposing shared content: Okta sessions, owner/editor/viewer policy, accessible-board home and private/shared indicators.
**Addresses / avoids:** Board discovery and ownership; prevents global catalog leakage and client-only permission enforcement. Resolve defaults and capability matrix; prove operator-managed tenant login separately from synthetic role tests.

### Phase 4: Durable Shared Boards
**Rationale / delivers:** Build server-owned document/asset persistence on the authorized board boundary, including create/reopen, save receipts, storage failures, snapshots and restore.
**Addresses / avoids:** Cross-session work and reference-image import; prevents local-cache-only saves and incomplete remote images. Gate on restart plus clean-browser recovery and denied cross-board asset access.

### Phase 5: Small-Group Collaboration
**Rationale / delivers:** Add authorized real-time synchronization, presence, reconnect and revocation to durable boards; complete concurrent mind-map semantics.
**Addresses / avoids:** Three-to-five-person editing; prevents remote undo loss, tree cycles and layout loops. Verify separate authenticated contexts, revoked queued writes and semantic convergence.

### Phase 6: Follow Me
**Rationale / delivers:** Use established presence for presenter viewport following, visible follow state, participant exit and presenter-disconnect handling.
**Addresses / avoids:** Guided sessions; prevents navigation polluting durable history and unclear behavior when presenter/follower collapse states differ.

### Phase 7: Comments
**Rationale / delivers:** Attach persistent discussion to stable objects or agreed coordinates with the approved reply/resolution behavior and permissions.
**Addresses / avoids:** Continued discussion of ideas; prevents detached or leaked anchors after deletion, undo, copying and board access changes.

### Phase 8: Shared Timer
**Rationale / delivers:** Introduce authoritative workshop session deadlines with approved start/pause/end permissions, refresh and late-join behavior.
**Addresses / avoids:** Timed exercises; prevents divergent browser countdowns and reset-on-refresh state.

### Phase 9: Voting
**Rationale / delivers:** Extend workshop sessions with eligible cards, participant invitations, configurable allowances, closing and result reveal while retaining editable cards.
**Addresses / avoids:** Prioritization; prevents concurrent overspending, retry duplication and early result disclosure. Decide repeated votes, anonymity, ties, deletion and late-join rules.

### Phase 10: Reusable Product Templates and Mockups
**Rationale / delivers:** Build on stable IDs and durable assets for customer-role, PMF, pains/gains, assumptions/findings and sprint layouts, plus editable mockups and reference-image compositions.
**Addresses / avoids:** Repeatable ideation and presentation ideation; prevents coupled copies and missing images through versioned template schemas, ID remapping and retained assets.

### Phase 11: Technical Diagram Palettes
**Rationale / delivers:** Add focused editable sequence, swimlane and C4-style compositions through the proven native command layer.
**Addresses / avoids:** Technical design; prevents disconnected labels/connectors and unnecessary formal-model scope. Verify movement, reopening, template copying and mixed-object export.

### Phase 12: Visual Roadmaps
**Rationale / delivers:** Reuse native compositions for releases, goals, features, status, icons and arrows, with reusable roadmap layouts.
**Addresses / avoids:** Manual planning/status workflows; preserves stable objects for eventual Plane linkage without introducing integration dependencies.

### Phase 13: Manual Date-Driven Gantt
**Rationale / delivers:** Add task dates, row order and navigable calendar geometry as a separate semantic capability.
**Addresses / avoids:** Date-positioned colored/labeled bars and templates; prevents timezone drift and uncontrolled scheduling scope. Verify leap days, month boundaries and invalid ranges.

### Phase 14: Editable MCP Creation
**Rationale / delivers:** Expose proven native diagrams and mind maps through board-targeted authenticated tools with durable idempotency and structured object IDs.
**Addresses / avoids:** Agent generation; prevents ambiguous targets, partial publication and browser-dependent success. Gate on actual client/issuer interoperability, closed-browser creation and crash/retry tests.

### Phase Ordering Rationale and Research Flags

- Phases execute sequentially; independent UI, backend and verification tasks may run in parallel inside an approved phase once their contracts are established. Later phase order reflects focused delivery, while actual prerequisites are board identity, durable assets, stable native IDs and authorization.
- **Deeper phase research:** 1–2 for exact BlockSuite interfaces/mind-map behavior; 3–5 for Okta, resource mapping, sync receipts and revocation; 14 for headless generation and actual MCP client/protocol/issuer compatibility. Resolve these integrations during the enabled research step before phase planning.
- **Targeted design validation:** 6–9 for follow/collapse, anchor lifecycle and workshop rules; 13 for calendar semantics. Research only the unresolved implementation questions after product rules are chosen.
- **Established composition patterns:** 10–12 can keep the enabled research step focused on remaining gaps after adapter, copy and asset contracts pass; retain feature acceptance checks. Export and operational recovery remain gates throughout.

## Confidence Assessment

| Area | Confidence | Basis and limit |
|---|---|---|
| Stack | MEDIUM | Exact local lockfile and official guides; proposed combinations uninstalled. |
| Features | MEDIUM | User scope is explicit; upstream source and Miro documentation inform behavior, with interaction details open. |
| Architecture | MEDIUM | Source lifecycle plus official Yjs/Okta/MCP guidance; Dali integration and capacity unmeasured. |
| Pitfalls | MEDIUM | Source-backed failure surfaces; prevention and test oracles are engineering proposals. |

### Gaps to Address

- **Runtime:** No upstream install/build/test/browser execution, native mind-map package inspection, live Okta validation, durable collaboration or headless MCP proof completed. Source presence establishes a candidate foundation only.
- **Requirements:** Confirm new-board defaults, collapse ownership, exact shortcuts, facilitation/comment rights, copy/deletion semantics, voting rules, calendar boundaries and export formats/scope/limits.
- **Operations:** Choose operator-managed hosting/storage, backup objectives, cache/logout policy, representative board/image sizes and measured latency/recovery targets; session size alone establishes no capacity guarantee.
- **Version/licensing:** Verify selected package tarballs and notices; align BlockSuite/Yjs; recheck supported build tooling. Stack/architecture cite MCP 2026-07-28 while pitfalls also uses 2025-11-25: pin one implemented revision and verify its client behavior explicitly.

## Sources

Scope: [PROJECT.md](../PROJECT.md) (authoritative user decisions). Detailed evidence: [STACK.md](STACK.md) (versions), [FEATURES.md](FEATURES.md) (capabilities), [ARCHITECTURE.md](ARCHITECTURE.md) (design), [PITFALLS.md](PITFALLS.md) (risks). External sources below were cited by the researchers; this synthesis performed no additional web research.

- DJAI Academy — upstream source at inspected commit: [https://github.com/DJAI-Academy/djai-open-canvas/tree/27f8bb97b10984e04e48d7650d954d0a7ecd212c](https://github.com/DJAI-Academy/djai-open-canvas/tree/27f8bb97b10984e04e48d7650d954d0a7ecd212c).
- BlockSuite — store architecture: [https://blocksuite.io/guide/store](https://blocksuite.io/guide/store); synchronization: [https://blocksuite.io/guide/data-synchronization](https://blocksuite.io/guide/data-synchronization). Conceptual APIs require pinned-version checks.
- Yjs — provider: [https://docs.yjs.dev/ecosystem/connection-provider/y-websocket](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket); undo: [https://docs.yjs.dev/api/undo-manager](https://docs.yjs.dev/api/undo-manager); awareness: [https://docs.yjs.dev/api/about-awareness](https://docs.yjs.dev/api/about-awareness).
- Miro Help Center — mind maps: [https://help.miro.com/hc/en-us/articles/360017730753-Mind-map](https://help.miro.com/hc/en-us/articles/360017730753-Mind-map); voting: [https://help.miro.com/hc/en-us/articles/360017572274-Voting](https://help.miro.com/hc/en-us/articles/360017572274-Voting); attention: [https://help.miro.com/hc/en-us/articles/360013358479-Attention-management](https://help.miro.com/hc/en-us/articles/360013358479-Attention-management).
- Okta — authorization servers: [https://developer.okta.com/docs/concepts/auth-servers/](https://developer.okta.com/docs/concepts/auth-servers/); PKCE: [https://developer.okta.com/docs/guides/implement-grant-type/authcodepkce/main/](https://developer.okta.com/docs/guides/implement-grant-type/authcodepkce/main/).
- Node.js — releases: [https://nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases); Fastify — LTS: [https://fastify.dev/docs/latest/Reference/LTS/](https://fastify.dev/docs/latest/Reference/LTS/); PostgreSQL — support: [https://www.postgresql.org/support/versioning/](https://www.postgresql.org/support/versioning/); Vite — releases: [https://vite.dev/releases](https://vite.dev/releases).
- Model Context Protocol — SDK v2: [https://ts.sdk.modelcontextprotocol.io/v2/](https://ts.sdk.modelcontextprotocol.io/v2/); authorization: [https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization); annotation limits: [https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/).
- MDN — image/export origin constraints: [https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image).

*Research synthesis completed: 2026-09-11. Ready for requirements and roadmap definition; runtime gates remain open.*
