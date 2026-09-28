---
phase: 04-durable-boards-and-recovery
verified: 2026-09-28T22:33:04.396Z
status: gaps_found
score: 4/5 consolidated acceptance truths verified within approved scope
covered_files: [".dockerignore",".planning/phases/04-durable-boards-and-recovery/04-01-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-01-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-02-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-02-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-03-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-03-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-04-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-04-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-05-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-05-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-06-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-06-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-07-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-07-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-08-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-08-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-09-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-09-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-10-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-10-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-11-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-11-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-12-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-12-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-13-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-13-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-14-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-14-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-15-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-15-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-16-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-16-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-17-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-UAT.md",".planning/phases/04-durable-boards-and-recovery/04-VALIDATION.md","Dockerfile","deploy/kubernetes/base/deployment.yaml","deploy/kubernetes/base/kustomization.yaml","deploy/kubernetes/base/network-policy.yaml","deploy/kubernetes/base/service.yaml","deploy/kubernetes/base/storage.yaml","deploy/kubernetes/overlays/example/ingress.yaml","deploy/kubernetes/overlays/example/kustomization.yaml","deploy/nginx.conf","docs/deployment.md","docs/local-role-testing.md","docs/operations.md","docs/recovery-acceptance.md","package.json","playwright.config.ts","scripts/deployment-smoke.mjs","scripts/dev-server.ts","scripts/dev-startup.test.mjs","scripts/dev.mjs","scripts/production-smoke.mjs","scripts/recovery-drill.mjs","server/app.ts","server/auth/oidc.test.ts","server/boards/access.test.ts","server/boards/actions.test.ts","server/boards/actions.ts","server/boards/blobs.ts","server/boards/documents.ts","server/boards/grants.test.ts","server/boards/grants.ts","server/boards/imports.ts","server/boards/library.test.ts","server/boards/operation-receipts.test.ts","server/boards/recovery.test.ts","server/boards/routes.ts","server/operator.ts","server/preflight.test.ts","server/storage/backup-scheduler.test.ts","server/storage/backup-scheduler.ts","server/storage/backup-validation.ts","server/storage/backup.test.ts","server/storage/backup.ts","server/storage/database.ts","server/storage/durability.test.ts","server/storage/lifecycle.ts","server/storage/operations-drill.test.ts","server/storage/recovery-state.ts","server/storage/restore.test.ts","server/storage/restore.ts","server/storage/write-admission.test.ts","server/storage/write-admission.ts","server/testing/application-assets.ts","server/testing/durability-child.ts","server/testing/recovery-dataset.ts","src/App.tsx","src/assets/fonts/README.md","src/assets/fonts/bebasneue/BebasNeue-Regular.ttf","src/assets/fonts/bebasneue/OFL.txt","src/assets/fonts/lora/Lora-Italic[wght].ttf","src/assets/fonts/lora/Lora[wght].ttf","src/assets/fonts/lora/OFL.txt","src/assets/fonts/orelegaone/OFL.txt","src/assets/fonts/orelegaone/OrelegaOne-Regular.ttf","src/assets/fonts/poppins/OFL.txt","src/assets/fonts/poppins/Poppins-Bold.ttf","src/assets/fonts/poppins/Poppins-BoldItalic.ttf","src/assets/fonts/poppins/Poppins-Italic.ttf","src/assets/fonts/poppins/Poppins-Regular.ttf","src/auth/AuthBoundary.tsx","src/auth/session.ts","src/boards/BoardLibrary.tsx","src/boards/ShareBoardDialog.tsx","src/boards/import-local.ts","src/boards/operations.ts","src/boards/pending-recovery.css","src/boards/pending-recovery.test.ts","src/boards/pending-recovery.ts","src/canvas/BlockSuiteCanvas.tsx","src/canvas/RecoveryStateView.tsx","src/canvas/StickyNoteTool.tsx","src/canvas/account/acknowledged-update.test.ts","src/canvas/account/acknowledged-update.ts","src/canvas/account/blob-source.test.ts","src/canvas/account/blob-source.ts","src/canvas/account/board-meta.test.ts","src/canvas/account/board-meta.ts","src/canvas/account/board-workspace.ts","src/canvas/account/doc-source.test.ts","src/canvas/account/doc-source.ts","src/canvas/account/local-capture.ts","src/canvas/account/mutation-guard.test.ts","src/canvas/account/mutation-guard.ts","src/canvas/account/outbox.test.ts","src/canvas/account/outbox.ts","src/canvas/account/recovery.test.ts","src/canvas/account/recovery.ts","src/canvas/account/title-intent.test.ts","src/canvas/account/title-intent.ts","src/canvas/canvas-fonts.ts","src/canvas/export-board.ts","src/canvas/formatting-controls.ts","src/canvas/leave-policy.ts","src/canvas/mindmap-keyboard.ts","src/canvas/recovery-archive.test.ts","src/canvas/recovery-archive.ts","src/canvas/resize-affordance.ts","src/canvas/runtime.ts","src/canvas/save-status.test.ts","src/canvas/save-status.ts","src/canvas/shape-text-editor.ts","src/canvas/sticky-note-tool.css","src/canvas/sticky.ts","src/header/BoardTitleMenu.tsx","src/header/Header.tsx","src/header/LeaveRecoveryDialog.tsx","src/header/SaveDetails.test.ts","src/header/SaveDetails.tsx","src/header/save-details.css","src/index.css","tests/access-boundaries.spec.ts","tests/access-fixtures.ts","tests/accessibility-access.spec.ts","tests/account-workspace.spec.ts","tests/backup-fence.spec.ts","tests/board-access.spec.ts","tests/board-actions.spec.ts","tests/board-library.spec.ts","tests/board-roles.spec.ts","tests/board-sharing.spec.ts","tests/board-title.spec.ts","tests/browser-fixtures.ts","tests/canvas-arrangement.spec.ts","tests/canvas-editing.spec.ts","tests/canvas-feedback.spec.ts","tests/canvas-interaction-refinements.spec.ts","tests/community.spec.ts","tests/connector-labels.spec.ts","tests/design-system.spec.ts","tests/durability-fixtures.ts","tests/durable-restart.spec.ts","tests/editing-followups.spec.ts","tests/fixtures.ts","tests/image-export.spec.ts","tests/image-import.spec.ts","tests/library-recovery-fixtures.ts","tests/library-recovery.spec.ts","tests/local-board-import.spec.ts","tests/local-recovery.spec.ts","tests/menu-sharing-refinement.spec.ts","tests/mindmap-accessibility.spec.ts","tests/mindmap-collapse.spec.ts","tests/mindmap-compatibility.spec.ts","tests/mindmap-copy.spec.ts","tests/mindmap-export.spec.ts","tests/mindmap-formatting.spec.ts","tests/mindmap-keyboard.spec.ts","tests/mindmap-layout.spec.ts","tests/mindmap-node-copy.spec.ts","tests/mindmap-properties.spec.ts","tests/mindmap-workflow.spec.ts","tests/mindmap.spec.ts","tests/note-resize-refinement.spec.ts","tests/oidc-provider.ts","tests/operational-recovery.spec.ts","tests/recovery-archive-fixtures.ts","tests/recovery-archive.spec.ts","tests/recovery-fixtures.ts","tests/recovery-navigation.spec.ts","tests/recovery-ui-matrix-reporter.ts","tests/recovery-ui-matrix-support.ts","tests/recovery-ui-matrix.spec.ts","tests/restored-board.spec.ts","tests/restored-viewer.spec.ts","tests/rotation-note-colors.spec.ts","tests/save-details-fixtures.ts","tests/save-details.spec.ts","tests/save-font-regressions.spec.ts","tests/save-status-fixtures.ts","tests/save-status.spec.ts","tests/session-recovery.spec.ts","tests/shape-text-lifecycle.spec.ts","tests/sticky-shadow.spec.ts","tests/sticky-tool.ts","tests/text-placement.spec.ts","tests/topic-focus-new-board.spec.ts","tests/ui-refinements.spec.ts","tests/viewer-recovery-status.spec.ts","tsconfig.production.json"]
covered_digest: "v2:sha256:5147120fea3bbd28148c271fcb6398046a38392411cff90a7c74ae6e29a0284a"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: Independent backup storage failure-domain and retention-capacity validation
    reason: User accepted scoped local Kubernetes validation and deferred independent infrastructure proof to backlog 999.6.
    accepted_by: user
    accepted_at: "2026-09-27"
  - must_have: Permitted Select image actions in Save details
    reason: User explicitly requested removal; stable labels, previews and image save status remain.
    accepted_by: user
    accepted_at: "2026-09-28"
gaps:
  - truth: Complete stable-source regression passes before Phase 4 closes.
    status: failed
    reason: Full run 2029/2036 passed; corrected-fixture repetitions 31/32 passed with WebKit recovery focus loss. Earlier runtime-error causes remain unresolved.
    artifacts:
      - path: tests/local-recovery.spec.ts
        issue: Final intervening-focus assertion failed in one WebKit repetition.
      - path: tests/connector-labels.spec.ts
        issue: Firefox cancelled-action errors in the full run; not reproduced in focused repetitions.
      - path: tests/recovery-ui-matrix.spec.ts
        issue: WebKit session-request access-control error invalidated matrix evidence in the full run.
    missing:
      - Diagnose and correct the proven recovery-focus race.
      - Classify intermittent runtime errors without weakening the strict error collector.
      - Pass the complete regression and all required matrix predicates at a stable source identity.
---

# Phase 4 — Verification report

**Status: gaps_found. Phase 4 remains open.** User acceptance of all seven scoped judgments is recorded; the remaining blocker is automated regression evidence.

## Consolidated goal checks

| Truth | Result | Evidence and scope |
|---|---|---|
| Saved documents and images survive restart and cold authorized reopen | Verified within local tested scope | Real SQLite SIGKILL/restart and cold-browser suites; current full-run durability/restored-board checks; `04-01-SUMMARY.md`, `04-15-SUMMARY.md` |
| Saved/pending/failed state follows current acknowledged content | Core behavior verified; final recovery UI regression unresolved | 236 client tests, exact document/image acknowledgment tests, save-status suites; focus failure remains below |
| Operators can deploy the documented service | Verified with approved scope exception | Retained actual container/local Kubernetes evidence in `04-LOCAL-KUBERNETES-VALIDATION.md`; independent storage/capacity deferred |
| Selected backup restores content and access before traffic reopens | Verified with approved scope exception | 311 serialized server tests, native restore/Viewer suites, retained selected-backup local drill; current browser fixtures and older cluster image are separate evidence |
| Complete current-source regression and UI acceptance pass | Failed | 2,029/2,036 full-run passes; 31/32 focused repetitions; G-04-38 |

The consolidated truths cover the roadmap goal and plan outcomes. Detailed plan/task/decision/UI mappings are retained in `COVERAGE.md`, `04-VALIDATION.md` and the acceptance report. This report does not mark the four phase requirements complete.

## Runtime evidence

| Command / gate | Observed result |
|---|---|
| `npm run typecheck` and `npm run typecheck:server` | Passed, including after the two fixture corrections |
| `npm test` | 236/236 passed, 20 files |
| `npm run test:server -- --maxWorkers=1` | 311/311 passed, 14 files |
| Production build in browser startup | Passed |
| `DALI_UI_MATRIX=1 npm run test:browser` at `e93b933` | 2,029 passed, seven failed, zero skipped, 1.9 hours |
| Four affected scenarios, four projects, two repetitions | 31/32 passed, zero skipped, 5.8 minutes |
| Native 200% zoom and visible tab-close warning | User-reported pass; browser/version unspecified |
| Seven scoped prohibition judgments | Explicitly accepted by user on 2026-09-28 |

The full-run source digest is `1874cca1f07f7daa2d61ee3336e8a847ea0a21d775f7ace88eacfd9ea7c44d98`, including pre-existing tracked package-script changes. The reporter rejected the full matrix. Sequence numbers in interim updates were incorrectly described as pass totals; final reporter counts above supersede those updates.

An initial concurrently run server suite was interrupted and is not passing evidence; the isolated serialized run supplies the recorded server result.

## Failure diagnosis and corrections

- Four full-run failures expected the old Opening board label during document recovery. The stage now correctly renders Recovering changes. `c06600b` updates that assertion while retaining the original focus and empty-board checks.
- The development failed-replay fixture allowed its edit to save before installing the outage. `c06600b` installs failure before the edit, verifies pending records, then expires/reopens the session. All eight focused replay cases pass.
- The corrected loading test reaches the focus invariant: one WebKit repetition loses intervening focus after editor visibility. Seven other repetitions pass. This remains a real failing assertion requiring diagnosis; it is not waived.
- Firefox cancelled-action page errors and WebKit session-request access-control page errors occurred in the full run. Eight focused executions of each scenario did not reproduce them. Their causes remain unresolved, and the strict error collector remains unchanged.

[04-17-PLAN.md](04-17-PLAN.md) defines G-04-38 closure and the mandatory frozen-source complete rerun. No further full browser run is active at this report.

## Artifacts and wiring

| Boundary | Source and consumer | Verification |
|---|---|---|
| HTTP acknowledgment → durable bytes | `server/boards/documents.ts` → SQLite transaction in `server/storage/database.ts` | WAL/FULL readback, failed-write and cold-restart tests |
| Local edits → retained journal → authorized replay | `src/canvas/account/outbox.ts` → `recovery.ts` and runtime coordinator | Native IndexedDB scope, abort, quota, migration and replay tests |
| Exact acknowledgment → visible status | `acknowledged-update.ts` / document and blob sources → `save-status.ts` → Header/SaveDetails | Current-content coverage, late receipts, per-image failures and save-font regressions |
| Pending data → downloaded editable archive | `recovery-archive.ts` → current-authority handoff → private Import | Decoded content and image-hash round trip, missing-byte rejection |
| Backup → operator-selected restore | `backup.ts` → `restore.ts` / `operator.ts` | Real file-backed integrity, digest, session reset, epoch rotation and cold access checks |
| Test results → acceptance | UI predicate attachments → strict matrix reporter | Current full run correctly rejected missing passing evidence |

## Requirements

| Requirement | Owning plans | Phase acceptance |
|---|---|---|
| SAVE-01 | 01–04, 06, 12, 15–17 | Pending final gate |
| SAVE-02 | 02–09, 11–12, 15–17 | Pending recovery focus and final gate |
| OPS-01 | 11, 13–17 | Local evidence retained; phase acceptance pending |
| OPS-02 | 02, 10–12, 14–17 | Local evidence retained; phase acceptance pending |

Decision coverage reports 15/15 honored, with the explicit Select image override recorded above. L1 threat review covers 18 authored threats with no open declared mitigation, subject to the accepted infrastructure exception. This does not supersede failed runtime acceptance. UI review records the recovery-focus blocker and two minor typography/spacing differences.

## Accepted scope and remaining limits

Independent failure-domain/capacity proof remains backlog 999.6; actual-provider configuration remains 999.4; spoken assistive technology remains 999.3. The local Kubernetes image predates subsequent application corrections; current cold Viewer and restoration behavior is verified through fresh fixture services, not a claimed cluster redeployment. Recovery timings are local measured results only.

No additional user judgment is requested. The seven accepted dispositions remain accepted. The remaining work is diagnosed regression closure and passing automated evidence.
