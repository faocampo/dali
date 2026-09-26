# Deferred Phase 4 Findings

## Authorized Viewer recovery label — resolved in 04-07

The preexisting `RecoveryCoordinator` emits `denied` for an authorized Viewer to avoid inspecting or replaying pending writes. `App` permits that read-only canvas, while `Header` treats the denied recovery outcome as recovery attention. This combination existed before plan 04-05 (base `877dc4b`). Verify the visible Viewer label during 04-07 status UI work or phase verification, then distinguish read-only hydration from access loss if reproduced. No native reproduction or requirement acceptance is claimed by this source observation.

Plan 04-07 now renders Read only for the active authorized Viewer and omits local recovery metadata, retry and editable archive actions. The native `tests/save-details.spec.ts` Viewer regression confirms visible read-only details and a read-only canvas store. The historical diagnosis above was source-based; the old bundle was not separately replayed. Authorization, journal inspection and replay boundaries remain unchanged. Phase-wide requirement acceptance remains pending.
