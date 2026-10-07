# Phase 4: Durable Boards and Recovery - Context

**Gathered:** 2026-09-25
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Deliver SAVE-01, SAVE-02, OPS-01 and OPS-02: acknowledged board content and images survive ordinary service restarts and reopen in an authorized browser with no prior cache; pending changes and failures remain distinguishable; operators can deploy the service and back up, restore and verify its data.

This discussion selects local preservation and recovery for an already open board during an outage. Phase 5 retains simultaneous editing, multi-user convergence, presence, personal undo and active-session revocation acceptance. Preserve existing authorization checks throughout recovery.

The approved one-hour disaster data-loss allowance applies to loss of server storage requiring backup restoration. Ordinary restarts must preserve acknowledged saves. Planned upgrade downtime and disaster restoration time are separate targets, each explicitly allowed up to 24 hours.
</domain>

<decisions>
## Implementation Decisions

### Save status and failures

- **D-01:** Keep save problems beside the board title, with details available on click. Preserve the existing last-save age presentation. The user selected this instead of a persistent banner or blocking failure dialog.
- **D-02:** Retry failed saves automatically in the background. Details offer **Retry now** and **Download recovery copy**. The recovery copy includes pending changes and images available in that browser.
- **D-03:** When board content saves but an image upload fails, show **Image not saved** beside the title. Details identify the affected image and offer recovery actions. Show **Saved** only after content and images are confirmed saved.
- **D-04:** If saving has failed or stalled and the user tries to leave, warn that some changes have not reached the server and let them stay or leave. Preserve pending work locally where possible. This warning addresses unresolved save problems; routine short saves were not assigned a blocking confirmation.

### Interrupted work

- **D-05:** For an already open board during temporary connection loss or service outage, continue editing with changes preserved locally and visibly pending. Send them after reconnection and a fresh access check. A known expired session still pauses editing until sign-in.
- **D-06:** When the same board is reopened in the same browser, recover pending work automatically after confirming the same account and editing permission. Retry saving and show recovery progress beside the title.
- **D-07:** If local recovery storage becomes full or unavailable during an outage, pause further editing. Keep existing work visible and offer **Download recovery copy** and **Retry saving**.
- **D-08:** Mark an accessible board card with **Changes waiting to save** in the browser holding pending work. Keep that indication until saving succeeds. Maintain account isolation; another account must not receive the pending work or its metadata.

### Deployment expectations

- **D-09:** Target an existing operator-managed **Kubernetes** platform for internal deployment.
- **D-10:** Planned maintenance is acceptable. The user explicitly allowed **up to one day when necessary**, overriding the proposed 5-, 15- and 30-minute options. Preserve pending work and recover it when service returns.
- **D-11:** No additional platform standards were imposed. Research proposes a portable deployment, including packaging, storage, ingress/TLS, secret handling and release procedure. Real operator configuration remains exclusively outside the public repository.

### Backups and restoration

- **D-12:** After loss of server storage requiring backup restoration, permit **at most one hour of recent acknowledged saved work to be lost** (recovery point objective, RPO: 1 hour).
- **D-13:** Retain backups for **30 days**.
- **D-14:** Restore usable service **within 24 hours** of a storage failure (recovery time objective, RTO: 24 hours). Include restoration of board content and images and verification that authorized members can reopen them.
- **D-15:** Restoration is **operator-initiated**: an operator selects a backup, follows the documented procedure and verifies the restored service before reopening access. Scheduled backups run automatically.

### Prior decisions carried forward

- Admission remains limited to approved internal members. Preserve effective Owner/Editor/Viewer capabilities, including Owner privileges for existing creators, account-isolated pending work and fresh authorization before replay.
- Session expiry pauses editing and preserves pending work. Deliberate sign-out ends the Dali session; pending work cannot replay into another identity or a board without current write permission.
- File import creates a new privately owned canvas from a Dali archive. The earlier optional **Copy local boards** workflow was removed by explicit user direction. PROJECT.md and current acceptance records supersede Phase 3 context D-16 on this point.
- Actual-provider configuration and acceptance remain deferred to backlog 999.4; assistive-technology speech and interaction acceptance remain deferred to 999.3. Keep generic deployment validation and actual-provider acceptance separately identified.

### Implementation discretion and research obligations

Research and planning choose mechanisms that meet these outcomes: durable acknowledgment, local journaling, retry timing, stalled-save detection, image failure attribution, archive completeness, portable Kubernetes packaging, storage, backup scheduling/retention and restore validation. No database migration, storage vendor, cluster version, chart format or cloud provider was selected in this discussion.

Investigate native browser navigation-warning limits, local storage failures, reload/crash recovery and stale local journals after server restore. Preserve authorization and do not allow automatic recovery to silently undo the selected restore or expose data across accounts. Resolve those mechanisms in research and planning; this discussion does not claim they are implemented.

A successful restoration must include the metadata and image associations needed to reopen boards under the applicable access rules. Backup freshness, retention and restoration-time targets need measured acceptance with synthetic data; define the representative validation dataset and operational prerequisites during planning.
</decisions>

<canonical_refs>
## Canonical References

Downstream agents must read these repository-relative sources before research, planning or implementation:

- `AGENTS.md` — public repository privacy boundary, sequential workflow and product constraints.
- `.planning/PROJECT.md` — current product decisions, ownership, file import and approved deferrals.
- `.planning/REQUIREMENTS.md` — SAVE-01, SAVE-02, OPS-01 and OPS-02.
- `.planning/ROADMAP.md` — Phase 4 success criteria and Phase 5 collaboration boundary.
- `.planning/config.json` — enabled research, plan checking, verification and execution settings.
- `.planning/phases/03-okta-and-board-access/03-CONTEXT.md` — session preservation and access decisions; apply the superseding import/role decisions in PROJECT.md.
- `.planning/phases/01-editable-canvas-and-image-portability/01-CONTEXT.md` — canvas/image behavior to preserve.
- `docs/access-acceptance.md` — generic configuration interfaces, identity-aware recovery and archive import. Its historical provider/native acceptance wording must be interpreted with current PROJECT.md deferrals.

No external specification was supplied. Consult current primary Kubernetes and selected storage/backup documentation during research; no operator-specific configuration belongs in these artifacts.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/canvas/account/outbox.ts` — IndexedDB account/board-scoped journal, pending records and acknowledgment removal; replay checks identity and permissions and sends images before document updates.
- `src/canvas/runtime.ts` — access-scope lifecycle, preservation during suspension, pending journal replay and document/image acknowledgment callbacks.
- `src/canvas/account/board-workspace.ts` — authorized board workspace and document/blob synchronization lifecycle.
- `src/canvas/save-status.ts` — document and image state aggregation. Existing local-storage wording and failure accounting require review for the server-backed save contract.
- `src/header/Header.tsx` — title-adjacent status, elapsed save age and failure details with retry and editable download actions.

### Established Patterns

- React owns the shell; the native canvas workspace owns board content. Recovery is scoped to account, board and access generation.
- `server/storage/database.ts` provides server-side SQLite opening and transactional migration bookkeeping. Existing storage is a foundation to assess against restart and recovery requirements.
- `docs/access-acceptance.md` describes a shared frontend/API origin and external operator-supplied settings. The current development launcher uses synthetic identity and must remain separate from production deployment.

### Integration Points

- `src/boards/BoardLibrary.tsx` — pending-work markers on accessible board cards.
- `src/canvas/account/doc-source.ts` and `src/canvas/account/blob-source.ts` — save acknowledgments, failures and local preservation.
- `src/auth/session.ts` — recovery revalidation and session interruption.
- `server/boards/documents.ts`, `server/boards/blobs.ts` and `server/app.ts` — durable content/image storage and deployment configuration.
- Add portable deployment and operator backup/restore procedures within the approved plan. Existing development scripts and current user work must be preserved.
</code_context>

<specifics>
## Specific Ideas

- Keep recovery information in the compact existing title/status interaction.
- Use **Image not saved** and **Changes waiting to save** for the specific failure and library states discussed.
- Internal Kubernetes deployment may use up to a day of planned maintenance when necessary.
- Distinguish four explicit operational values: 24-hour planned maintenance allowance, 1-hour disaster RPO, 30-day backup retention and 24-hour disaster RTO.
</specifics>

<deferred>
## Deferred Ideas

No new deferred feature ideas were introduced. Existing real-provider and assistive-technology follow-ups retain backlog 999.4 and 999.3. Multi-user collaboration and convergence retain Phase 5 allocation.
</deferred>

---
*Phase: 04-durable-boards-and-recovery*
*Context gathered: 2026-09-25*
