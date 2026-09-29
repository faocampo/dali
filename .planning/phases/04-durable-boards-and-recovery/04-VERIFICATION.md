---
phase: 04-durable-boards-and-recovery
verified: 2026-09-29T02:33:31.452392+00:00
status: gaps_found
score: 4/5 consolidated acceptance truths verified within approved scope
covered_files: [".dockerignore",".planning/phases/04-durable-boards-and-recovery/04-01-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-01-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-02-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-02-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-03-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-03-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-04-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-04-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-05-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-05-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-06-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-06-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-07-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-07-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-08-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-08-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-09-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-09-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-10-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-10-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-11-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-11-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-12-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-12-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-13-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-13-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-14-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-14-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-15-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-15-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-16-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-16-SUMMARY.md",".planning/phases/04-durable-boards-and-recovery/04-17-DIAGNOSIS.md",".planning/phases/04-durable-boards-and-recovery/04-17-PLAN.md",".planning/phases/04-durable-boards-and-recovery/04-UAT.md",".planning/phases/04-durable-boards-and-recovery/04-VALIDATION.md","Dockerfile","deploy/kubernetes/base/deployment.yaml","deploy/kubernetes/base/kustomization.yaml","deploy/kubernetes/base/network-policy.yaml","deploy/kubernetes/base/service.yaml","deploy/kubernetes/base/storage.yaml","deploy/kubernetes/overlays/example/ingress.yaml","deploy/kubernetes/overlays/example/kustomization.yaml","deploy/nginx.conf","docs/deployment.md","docs/local-role-testing.md","docs/operations.md","docs/recovery-acceptance.md","package.json","playwright.config.ts","scripts/deployment-smoke.mjs","scripts/dev-server.ts","scripts/dev-startup.test.mjs","scripts/dev.mjs","scripts/production-smoke.mjs","scripts/recovery-drill.mjs","server/app.ts","server/auth/oidc.test.ts","server/boards/access.test.ts","server/boards/actions.test.ts","server/boards/actions.ts","server/boards/blobs.ts","server/boards/documents.ts","server/boards/grants.test.ts","server/boards/grants.ts","server/boards/imports.ts","server/boards/library.test.ts","server/boards/operation-receipts.test.ts","server/boards/recovery.test.ts","server/boards/routes.ts","server/operator.ts","server/preflight.test.ts","server/storage/backup-scheduler.test.ts","server/storage/backup-scheduler.ts","server/storage/backup-validation.ts","server/storage/backup.test.ts","server/storage/backup.ts","server/storage/database.ts","server/storage/durability.test.ts","server/storage/lifecycle.ts","server/storage/operations-drill.test.ts","server/storage/recovery-state.ts","server/storage/restore.test.ts","server/storage/restore.ts","server/storage/write-admission.test.ts","server/storage/write-admission.ts","server/testing/application-assets.ts","server/testing/durability-child.ts","server/testing/recovery-dataset.ts","src/App.tsx","src/assets/fonts/README.md","src/assets/fonts/bebasneue/BebasNeue-Regular.ttf","src/assets/fonts/bebasneue/OFL.txt","src/assets/fonts/lora/Lora-Italic[wght].ttf","src/assets/fonts/lora/Lora[wght].ttf","src/assets/fonts/lora/OFL.txt","src/assets/fonts/orelegaone/OFL.txt","src/assets/fonts/orelegaone/OrelegaOne-Regular.ttf","src/assets/fonts/poppins/OFL.txt","src/assets/fonts/poppins/Poppins-Bold.ttf","src/assets/fonts/poppins/Poppins-BoldItalic.ttf","src/assets/fonts/poppins/Poppins-Italic.ttf","src/assets/fonts/poppins/Poppins-Regular.ttf","src/auth/AuthBoundary.tsx","src/auth/session.ts","src/boards/BoardLibrary.tsx","src/boards/ShareBoardDialog.tsx","src/boards/import-local.ts","src/boards/operations.ts","src/boards/pending-recovery.css","src/boards/pending-recovery.test.ts","src/boards/pending-recovery.ts","src/canvas/BlockSuiteCanvas.tsx","src/canvas/RecoveryStateView.tsx","src/canvas/StickyNoteTool.tsx","src/canvas/account/acknowledged-update.test.ts","src/canvas/account/acknowledged-update.ts","src/canvas/account/blob-source.test.ts","src/canvas/account/blob-source.ts","src/canvas/account/board-meta.test.ts","src/canvas/account/board-meta.ts","src/canvas/account/board-workspace.ts","src/canvas/account/doc-source.test.ts","src/canvas/account/doc-source.ts","src/canvas/account/local-capture.ts","src/canvas/account/mutation-guard.test.ts","src/canvas/account/mutation-guard.ts","src/canvas/account/outbox.test.ts","src/canvas/account/outbox.ts","src/canvas/account/recovery.test.ts","src/canvas/account/recovery.ts","src/canvas/account/title-intent.test.ts","src/canvas/account/title-intent.ts","src/canvas/canvas-fonts.ts","src/canvas/export-board.ts","src/canvas/formatting-controls.ts","src/canvas/leave-policy.ts","src/canvas/mindmap-keyboard.ts","src/canvas/recovery-archive.test.ts","src/canvas/recovery-archive.ts","src/canvas/resize-affordance.ts","src/canvas/runtime.ts","src/canvas/save-status.test.ts","src/canvas/save-status.ts","src/canvas/shape-text-editor.ts","src/canvas/sticky-note-tool.css","src/canvas/sticky.ts","src/header/BoardTitleMenu.tsx","src/header/Header.tsx","src/header/LeaveRecoveryDialog.tsx","src/header/SaveDetails.test.ts","src/header/SaveDetails.tsx","src/header/save-details.css","src/index.css","tests/access-boundaries.spec.ts","tests/access-fixtures.ts","tests/accessibility-access.spec.ts","tests/account-workspace.spec.ts","tests/backup-fence.spec.ts","tests/board-access.spec.ts","tests/board-actions.spec.ts","tests/board-library.spec.ts","tests/board-roles.spec.ts","tests/board-sharing.spec.ts","tests/board-title.spec.ts","tests/browser-fixtures.ts","tests/canvas-arrangement.spec.ts","tests/canvas-editing.spec.ts","tests/canvas-feedback.spec.ts","tests/canvas-interaction-refinements.spec.ts","tests/community.spec.ts","tests/connector-labels.spec.ts","tests/design-system.spec.ts","tests/durability-fixtures.ts","tests/durable-restart.spec.ts","tests/editing-followups.spec.ts","tests/fixtures.ts","tests/image-export.spec.ts","tests/image-import.spec.ts","tests/library-recovery-fixtures.ts","tests/library-recovery.spec.ts","tests/local-board-import.spec.ts","tests/local-recovery.spec.ts","tests/menu-sharing-refinement.spec.ts","tests/mindmap-accessibility.spec.ts","tests/mindmap-collapse.spec.ts","tests/mindmap-compatibility.spec.ts","tests/mindmap-copy.spec.ts","tests/mindmap-export.spec.ts","tests/mindmap-formatting.spec.ts","tests/mindmap-keyboard.spec.ts","tests/mindmap-layout.spec.ts","tests/mindmap-node-copy.spec.ts","tests/mindmap-properties.spec.ts","tests/mindmap-workflow.spec.ts","tests/mindmap.spec.ts","tests/note-resize-refinement.spec.ts","tests/oidc-provider.ts","tests/operational-recovery.spec.ts","tests/recovery-archive-fixtures.ts","tests/recovery-archive.spec.ts","tests/recovery-fixtures.ts","tests/recovery-navigation.spec.ts","tests/recovery-pagehide.spec.ts","tests/recovery-ui-matrix-reporter.ts","tests/recovery-ui-matrix-support.ts","tests/recovery-ui-matrix.spec.ts","tests/restored-board.spec.ts","tests/restored-viewer.spec.ts","tests/rotation-note-colors.spec.ts","tests/save-details-fixtures.ts","tests/save-details.spec.ts","tests/save-font-regressions.spec.ts","tests/save-status-fixtures.ts","tests/save-status.spec.ts","tests/session-recovery.spec.ts","tests/shape-text-lifecycle.spec.ts","tests/sticky-shadow.spec.ts","tests/sticky-tool.ts","tests/text-placement.spec.ts","tests/topic-focus-new-board.spec.ts","tests/ui-refinements.spec.ts","tests/viewer-recovery-status.spec.ts","tsconfig.production.json"]
covered_digest: "v2:sha256:4c5d8a59e073e79c4c5ffdf7c9cc9e3bc69f6a003656f09e8257253bdd262a1c"
behavior_unverified: 2026-09-29T02:33:31.452392+00:00
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
    reason: Complete 3e9d68b run passed 2051/2052; one WebKit details-cardinality case emitted unexpected blob/session fetch errors.
    artifacts:
      - path: tests/recovery-ui-matrix.spec.ts
        issue: Strict unexpected-error collector rejects blob-read and recovery session-read errors in the 50-image scenario.
    missing:
      - Diagnose the remaining WebKit request/promise lifecycle boundary without suppressing errors.
      - Pass the complete regression and all required matrix predicates at a stable source identity.
---

# Phase 4 — Verification report

**Status: gaps_found. Phase 4 remains open.** All seven user judgments remain accepted. The remaining blocker is one automated runtime-error case in the complete regression.

## Consolidated goal checks

| Truth | Result | Evidence and scope |
|---|---|---|
| Saved documents and images survive restart and cold authorized reopen | Verified within local tested scope | SQLite restart, cold restored-board and restored-Viewer checks pass in the current full run; retained operational scope is in 04-15-SUMMARY.md |
| Saved/pending/failed state follows current acknowledged content | Core behavior verified; final recovery UI regression unresolved | 236 client tests and current save-status suites pass; WebKit details-cardinality error remains |
| Operators can deploy the documented service | Verified with approved scope exception | Retained local Kubernetes validation; independent storage/capacity deferred |
| Selected backup restores content and access before traffic reopens | Verified with approved scope exception | Retained 311 serialized server passes, current native restore/Viewer suites and earlier selected-backup local drill |
| Complete current-source regression and UI acceptance pass | Failed | 2,051/2,052 full-run passes; five WebKit predicates lack passing evidence; G-04-38 |

Detailed task/decision/UI mappings remain in COVERAGE.md, 04-VALIDATION.md and the acceptance report. The four phase requirements remain pending final acceptance.

## Runtime evidence

| Gate | Observed result |
|---|---|
| Both TypeScript checks | Passed after lifecycle correction |
| Client unit suite | 236/236 passed, 20 files |
| Serialized server suite | Retained 311/311 passes; server source unchanged by these corrections |
| Production build in browser startup | Passed |
| Repeated cross-engine recovery/lifecycle gate | 88/88 passed, zero skips/retries, 8.4 minutes |
| Complete browser gate at 3e9d68b | 2,051 passed, one failed, zero skipped/retried, 2,052 selected, 1.9 hours |
| Recovery matrix | Chromium and Firefox: 13 scenarios/36 predicates each; WebKit: 12 passing scenarios/31 predicates |
| Native zoom and tab-close checks | User-reported pass; browser/version unspecified |
| Seven scoped judgments | Explicit user acceptance retained |

Full-run revision: `3e9d68b71290988112a51742d227b6fbdf795d9c`. Source digest: `bf8e75b776bd8eab87457ad855560f0a8fcd9c19236eb2cfadd27c9793f4fc5d`, including pre-existing tracked package-script changes. The source remained stable. Reporter exit was nonzero and acceptance was withheld. No full regression process remains active.

## Failure diagnosis and corrections

The prior label/outage fixture issues were corrected in c06600b. Cursor-notification focus theft and invalid clock-install ordering were corrected in 6296526. Pagehide failed to cancel active account-board requests; 3e9d68b now suspends the scope, aborts requests and preserves pending work before fresh authorization on persisted pageshow. All dedicated regressions and both previously failing reload cases pass in the current full run.

The remaining failure is `tests/recovery-ui-matrix.spec.ts:233` in production WebKit. The 50-image Save Details assertions completed, but unexpected blob-read and session-read access-control page errors failed the strict collector. Blob frames reach the account source from canvas rendering; session frames reach recovery retry after an image failure. The exact promise/lifecycle cause remains unresolved. WebKit lacks passing E1/overflow, E1/long-text, E2/overflow, E2/zero-one-many and E2/long-text evidence as a result.

Historical results remain in [04-17-DIAGNOSIS.md](04-17-DIAGNOSIS.md): e93b933 returned 2,029/2,036; 6296526 stopped with 1,604 passes, two failures, one interrupted and 429 unrun. Focused success has never replaced the complete gate. No allowlist, retry, skip or weakened assertion was introduced.

## Artifacts and wiring

| Boundary | Source and consumer | Verification |
|---|---|---|
| HTTP acknowledgment to durable bytes | documents.ts to database.ts | WAL/FULL, failed-write and cold-restart tests |
| Local edits to retained authorized replay | outbox.ts to recovery.ts/runtime.ts | IndexedDB scope, abort, quota, migration and replay tests |
| Exact acknowledgment to visible status | document/blob sources to save-status.ts and SaveDetails | Current-content coverage and late-receipt tests |
| Page hide to request cancellation | session.ts to suspendAccessScope and recovery disposal | Fail-first AbortSignal/read-only/journal assertions; reload and persisted restoration |
| Recovery download to private import | recovery-archive.ts to current-authority handoff | Decoded archive and image-byte round trips |
| Backup to selected restore | backup.ts to restore.ts/operator.ts | Integrity, digest, session reset, epoch rotation and cold access |
| Test evidence to acceptance | Predicate attachments to strict reporter | Current gate correctly withheld acceptance |

## Requirements and retained limits

SAVE-01, SAVE-02, OPS-01 and OPS-02 remain pending final Phase 4 acceptance. Decision coverage remains 15/15, including the explicit Select image override. The earlier 18-threat review retains its source scope; the pagehide delta was reviewed inline for cancellation, retained records, read-only enforcement, fresh authorization and stale-transition fencing. No new access bypass was identified. This scoped review does not supersede the failed runtime gate.

The previous focus blocker is corrected; the original visual sample retains its two minor typography/spacing differences and 22/24 sampled score. Current overall UI acceptance remains blocked by the WebKit error.

Independent storage/capacity remains 999.6, actual-provider acceptance 999.4, and spoken assistive technology 999.3. The retained Kubernetes image predates subsequent corrections; current browser fixtures establish their own source scope. No cluster redeployment or production recovery timing is claimed.

Autonomous continuation awaits the required retry/skip/stop choice. The seven accepted judgments are not being reopened.
