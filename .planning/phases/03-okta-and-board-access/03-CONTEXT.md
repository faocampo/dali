# Phase 3: Okta and Board Access - Context

**Gathered:** 2026-09-15
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Deliver AUTH-01 and BOARD-01 through BOARD-04: configurable OIDC sign-in with Okta compatibility, named boards in an authenticated home, visible private/shared status and member roles, owner-managed internal access, and permission enforcement for documents and images.

Phase 3 establishes the authenticated access path and the minimum storage needed to exercise it. Phase 4 owns durable recovery, restart, backup and deployment acceptance; Phase 5 owns live collaboration, reconnection and active-session revocation acceptance. Carry the Phase 3 access rules into those later transports.

All configuration examples, identity fixtures and validation evidence in the repository remain synthetic and organization-neutral. Operator-specific settings and real-provider evidence stay in operator-controlled infrastructure.
</domain>

<decisions>
## Implementation Decisions

### Sign-in and sessions — explicit user selections

- **D-01:** Redirect signed-out users directly to Okta. Preserve a requested board target through authentication and open it when authorized. Entry without a board target lands in the board library; an unauthorized target uses the access-denied state in D-13.
- **D-02:** When a session expires during editing, pause editing, preserve pending work, and show “Session expired — sign in to continue.” Resume the same board after authentication. Recovery must recheck both identity and board access before applying pending changes.
- **D-03:** Explicit sign-out ends the Dalí session only. Show a signed-out page with “Sign in again”; this page does not immediately trigger automatic login.
- **D-04:** Keep users signed in across browser restarts until the operator-configured session expiry. Exact lifetime and renewal mechanisms belong to research and deployment configuration.

### Sharing defaults — explicit user selections

- **D-05:** New boards are private to their creator. Owners can share afterward.
- **D-06:** Owners can search existing internal members or enter an internal email before that person's first sign-in. Such a pending grant becomes usable only after a valid internal SSO identity is established. Owners can revoke pending grants as well as active grants. Email-to-identity matching requires validation during research.
- **D-07:** A new grant defaults to Viewer; the owner can explicitly choose Editor.
- **D-08:** Links convey a board location, while access requires an explicit grant or ownership. Sharing a link alone never grants access.

### Role capabilities

- **D-09 — explicit selection:** Viewers may export PNG and PDF. Editable board downloads require Owner or Editor.
- **D-10 — explicit selection:** Only owners and editors may duplicate a board. The copy is private, owned by its creator, and receives no inherited sharing grants.
- **D-11 — recommended option accepted through delegation:** Owners and editors may rename boards.
- **D-12 — delegated default:** Only owners may delete boards. Require confirmation that identifies the board. Granting, changing or revoking another member's access remains owner-only under BOARD-03.

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| View and navigate the board | Yes | Yes | Yes |
| Modify canvas content and rename | Yes | Yes | No |
| Export PNG or PDF | Yes | Yes | Yes |
| Download editable board or duplicate | Yes | Yes | No |
| Manage sharing or delete the source board | Yes | No | No |

### Board home and existing work — recommended defaults under delegation

- **D-13:** Opening Dalí without a board target shows the authenticated board library. Explicit board links resume their target after sign-in and authorization. An inaccessible target shows a clear access-denied state with a route back to the library.
- **D-14:** Reuse the existing board-card layout, ordered by most recently updated. Provide All, Mine and Shared with me filters. Every accessible card shows private/shared status and the current member's Owner, Editor or Viewer role.
- **D-15:** Preserve the user-directed File > New behavior that opens a fresh board in another browser tab, and preserve the editable board title in the header. Creation establishes the creator as owner with private access; “Untitled board” remains a usable starting name.
- **D-16:** Offer explicit import/copy of selected browser-local boards into the signed-in account as private boards. Preserve the original local documents and images until the user deliberately removes them. Preserve titles and canvas content in the copies, and keep local work visibly distinct from account boards until imported. Account-bound caches and pending work must remain isolated across identities.

### Delegation and implementation discretion

The user answered D-01 through D-10 individually, then instructed: “move forward with recommended options.” D-11 uses the already-presented recommendation; D-12 through D-16 apply recommended defaults under that instruction. These defaults are planning inputs with recorded provenance, rather than separately answered questions.

Research and planning choose the backend, OIDC library, session storage, claims mapping, permission model representation, local-to-account copy mechanism, error text and routine styling. Respect the outcomes above. Validate preservation of pending edits through authentication interruptions, denial of writes after lost access, trusted matching of pending email grants, account/cache isolation, and coverage of native editor mutation paths. UI visibility must agree with authorization on direct document, image and mutation requests.

The phase's public checks use separate synthetic owner/editor/viewer/non-member contexts. Actual Okta integration validation remains a separately identified operator task. Local browser persistence and hidden UI controls alone do not establish the approved authenticated-access requirements.
</decisions>

<canonical_refs>
## Canonical References

Downstream agents must read these repository-relative sources before planning or implementing:

- `AGENTS.md` — public-repository boundary, workflow and product constraints.
- `.planning/PROJECT.md` — product goals, internal-member access, execution preferences and remaining design details.
- `.planning/REQUIREMENTS.md` — AUTH-01, BOARD-01 through BOARD-04 and validation obligations.
- `.planning/ROADMAP.md` — Phase 3 acceptance and the Phase 4/5 delivery boundaries.
- `.planning/config.json` — research, plan-check, verification and agent settings.
- `.planning/phases/01-editable-canvas-and-image-portability/01-CONTEXT.md` — established canvas and export behavior to preserve.

No external specification was supplied for this discussion. Provider protocol and library documentation should be checked during Phase 3 research.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/boards/BoardLibrary.tsx` — existing board cards, template previews, creation and board actions; adapt these to authenticated role-aware summaries.
- `src/boards/operations.ts` — local creation, rename, snapshot-based duplication and deletion. Snapshot conversion already regenerates IDs and validates mind-map documents.
- `src/header/DaliMenu.tsx` and `src/header/Header.tsx` — Main Menu actions and inline board naming; connect role-aware visibility and identity actions here.
- `src/header/ExportDialog.tsx` and `src/canvas/export-board.ts` — distinct editable-board, PNG and PDF exports; apply D-09 consistently to their entry points.

### Established Patterns

- React owns the app shell; BlockSuite owns canvas documents and editing. The inspected app starts its local runtime immediately and opens the editor.
- `src/canvas/workspace.ts` uses IndexedDB document/blob sources. Its existing database identifier protects saved local work and needs explicit migration handling if storage boundaries change.
- `src/boards/catalog.ts` stores browser-local metadata and previews. It has no authenticated ownership or grants.
- `src/canvas/BlockSuiteCanvas.tsx` already checks `store.readonly` in some command paths. Research must cover all editor/native/input mutation paths and server authorization.

### Integration Points

- `src/App.tsx` — authentication/startup routing, library entry, board access failures and session-expiry UI.
- `src/canvas/runtime.ts` — memoized workspace creation, document loading and disposal; account switching and authorization need to precede account document exposure.
- `src/boards/preferences.ts` — board target URLs and new-tab creation; preserve the requested destination through sign-in without trusting a stale local active-board preference as authorization.
- Document/blob source interfaces and local board operations — authenticated storage and permission checks, with explicit preservation of existing local work.
</code_context>

<specifics>
## Specific Ideas

Continue the existing compact Dalí shell, Main Menu, inline board title and accessible keyboard behavior. Use the existing library layout for the authenticated home. Keep owner/editor/viewer status visible and terminology consistent across board cards, the editor and sharing controls.
</specifics>

<deferred>
## Deferred Ideas

No new deferred feature ideas were introduced. Durable operations and shared collaboration retain their Phase 4 and Phase 5 allocation; later facilitation, templates, diagrams and integrations retain the approved roadmap sequence.
</deferred>

---
*Phase: 03-okta-and-board-access*
*Context gathered: 2026-09-15*
