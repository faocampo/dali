---
phase: "04"
slug: "durable-boards-and-recovery"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-25"
---

# Phase 4 — Validation Strategy

## Test Infrastructure

Existing Vitest frontend/server and Playwright browser projects are retained. Configurations: vite.config.ts, vitest.server.config.ts, playwright.config.ts.

Quick feedback: `npm test -- src/canvas/account/outbox.test.ts src/canvas/account/doc-source.test.ts src/canvas/account/blob-source.test.ts src/canvas/save-status.test.ts` and `npm run test:server -- server/boards/access.test.ts`.

Static gate: `npm run typecheck` and `npm run typecheck:server`.

Full gate: `npm test`, `npm run test:server`, `npm run build`, `npm run test:access`, `npm run test:browser`, followed by actual production-container, Kubernetes and storage-loss restore acceptance.

## Sampling Rate

Run matching focused tests and static checks per task, relevant integration/browser suites per wave, and full gates before phase acceptance. Target warm focused feedback under 30 seconds; measure timings during execution. Infrastructure drills run separately and report measured durations. No required skipped tests or zero-test matches count as passing.

## Per-Task Verification Map

All rows are planned / NOT_RUN. Each producing task creates its named tests first, before the command or dependent behavior consumes them. Every task also runs `npm run typecheck && npm run typecheck:server` (failure: nonzero exit or TypeScript diagnostics). Focused warm targets aim for under60seconds; browser startup and real I/O/drills use measured separate budgets. Required skips or zero selected tests never pass.

| Task | Wave | Requirements | Threat | Secure behavior / oracle | Exact automated command | Status |
|---|---|---|---|---|---|---|
| 04-01-01 | 1 | SAVE-01 | T-04-01-01 | Actual committed bytes survive SIGKILL and cold authorized reopen; a missing image or stale browser cache makes the test fail; an invalid persistent pragma prevents startup. | `npm exec playwright test -- tests/durable-restart.spec.ts --project=prod --grep @04-01-01` | NOT_RUN |
| 04-01-02 | 1 | SAVE-01 | T-04-01-01 | Known acknowledged updates all survive; a response lost after commit can be retried without a duplicate object/image association; failed commits emit no success acknowledgment. | `npm run test:server -- server/storage/durability.test.ts` ; `npm exec playwright test -- tests/durable-restart.spec.ts --project=prod --grep @04-01-02` | NOT_RUN |
| 04-02-01 | 2 | SAVE-01, SAVE-02, OPS-02 | T-04-02-01 | Same-epoch document pushes work; missing/stale epochs reject before changing bytes; restart retains epoch; authorized descriptors alone expose it; reads remain allowed to current Viewers. | `npm run test:server -- server/boards/recovery.test.ts -t @04-02-01` | NOT_RUN |
| 04-02-02 | 2 | SAVE-01, SAVE-02, OPS-02 | T-04-02-01 | A successful unrelated image cannot acknowledge another image; old-epoch image and metadata writes are rejected; same-epoch ordinary actions remain usable. | `npm test -- src/canvas/account/doc-source.test.ts src/canvas/account/blob-source.test.ts` ; `npm run test:server -- server/boards/recovery.test.ts -t @04-02-02` | NOT_RUN |
| 04-02-03 | 2 | SAVE-01, SAVE-02, OPS-02 | T-04-02-01 | A stale import stage cannot publish after restore; current operations remain idempotent; access and revision failures stay distinct from restore mismatch. | `npm run test:server -- server/boards/recovery.test.ts -t @04-02-03` | NOT_RUN |
| 04-03-01 | 3 | SAVE-01, SAVE-02 | T-04-03-01 | Completed local records survive native IndexedDB reload; interrupted transactions remain unconfirmed; v1 rows survive upgrade without automatic epoch adoption; unknown/corrupt schemas remain intact. | `npm test -- src/canvas/account/outbox.test.ts` ; `npm exec playwright test -- tests/local-recovery.spec.ts --project=prod --grep @04-03-01` | NOT_RUN |
| 04-03-02 | 3 | SAVE-01, SAVE-02 | T-04-03-01 | Late acks retain newer edits; compaction retains other-tab records; acknowledged assets remain available for pending reconstruction; unavailable local storage retains latest bytes in memory. | `npm test -- src/canvas/account/outbox.test.ts src/canvas/account/blob-source.test.ts` ; `npm exec playwright test -- tests/local-recovery.spec.ts --project=prod --grep @04-03-02` | NOT_RUN |
| 04-04-01 | 4 | SAVE-01, SAVE-02 | T-04-04-01 | No local metadata is read before current authority; outage remains editable with successful preservation; explicit expiry pauses; retries send once per scope and cannot apply late callbacks. | `npm test -- src/canvas/account/recovery.test.ts` ; `npm exec playwright test -- tests/local-recovery.spec.ts --project=prod --grep @04-04-01` | NOT_RUN |
| 04-04-02 | 4 | SAVE-01, SAVE-02 | T-04-04-01 | All covered native mutations are inert during unsafe storage pause; restored-board entry keeps the old journal; denied content is hidden; valid empty server board stays valid. | `npm test -- src/canvas/account/mutation-guard.test.ts src/canvas/account/recovery.test.ts` | NOT_RUN |
| 04-04-03 | 4 | SAVE-01, SAVE-02 | T-04-04-01 | E4 empty/loading/error/populated/overflow/long-text assertions all pass in native browser execution. | `npm exec playwright test -- tests/local-recovery.spec.ts --project=prod --grep @04-04-03` | NOT_RUN |
| 04-05-01 | 5 | SAVE-02 | T-04-05-01 | Old ack with newer edit stays pending; unrelated image success retains prior failure; image-only and combined failures differ; storage completion/export/dispatch cannot establish Saved. | `npm test -- src/canvas/save-status.test.ts` | NOT_RUN |
| 04-05-02 | 5 | SAVE-02 | T-04-05-01 | Visible Saved follows actual full server coverage; stalls become failed at the selected threshold; obsolete image failures clear only after confirmed removal from the current saved board. | `npm exec playwright test -- tests/save-status.spec.ts --project=prod --grep @04-05-02` | NOT_RUN |
| 04-06-01 | 6 | SAVE-01, SAVE-02 | T-04-06-01 | Zero-image board exports; required missing/corrupt image yields explicit error and zero download; paused memory snapshot exports when authorized; current-account changed during async preparation yields zero handoff. | `npm test -- src/canvas/recovery-archive.test.ts` ; `npm exec playwright test -- tests/recovery-archive.spec.ts --project=prod --grep @04-06-01` | NOT_RUN |
| 04-06-02 | 6 | SAVE-01, SAVE-02 | T-04-06-01 | Exactly one handoff per activation snapshot; successful export retains journal and pending marker; every failure leaves retry possible under current authority. | `npm exec playwright test -- tests/recovery-archive.spec.ts --project=prod --grep @04-06-02` | NOT_RUN |
| 04-07-01 | 7 | SAVE-02 | T-04-07-01 | Saved/pending/error trigger always opens details; background changes preserve focus and unresolved rows; empty images omit list; selection respects permissions. | `npm exec playwright test -- tests/save-details.spec.ts --project=prod --grep @04-07-01` | NOT_RUN |
| 04-07-02 | 7 | SAVE-02 | T-04-07-01 | Every image action remains reachable at320px/short heights; full accessible labels survive wrapping; focus and state changes remain stable. | `npm exec playwright test -- tests/save-details.spec.ts --project=prod --grep @04-07-02` | NOT_RUN |
| 04-08-01 | 8 | SAVE-02 | T-04-08-01 | Repeated rename retries yield one acknowledged intent; newer title survives old ack; storage pause rejects changes while showing current text; stale epoch never replays title. | `npm test -- src/canvas/account/title-intent.test.ts` | NOT_RUN |
| 04-08-02 | 8 | SAVE-02 | T-04-08-01 | Stay/Escape never navigate; duplicate Leave triggers one transition; ordinary pending short save never prompts; download/leave do not clear pending work. | `npm exec playwright test -- tests/recovery-navigation.spec.ts --project=prod --grep @04-08-02` | NOT_RUN |
| 04-09-01 | 6 | SAVE-02 | T-04-09-01 | Zero/one/many cards work; failed journal inspection is not empty; another account sees no old title/time/marker; card loading is independent of journal reads. | `npm test -- src/boards/pending-recovery.test.ts` ; `npm exec playwright test -- tests/library-recovery.spec.ts --project=prod --grep @04-09-01` | NOT_RUN |
| 04-09-02 | 6 | SAVE-02 | T-04-09-01 | Marker disappearance is board/record-specific;50 cards keep existing grid/one-column layout and controls remain reachable. | `npm exec playwright test -- tests/library-recovery.spec.ts --project=prod --grep @04-09-02` | NOT_RUN |
| 04-10-01 | 3 | OPS-02 | T-04-10-01 | Snapshot taken during writes is consistent; missing image/corrupt document/hash/schema is rejected; incomplete publication never becomes selectable; fresh copy retains access relationships. | `npm run test:server -- server/storage/backup.test.ts -t @04-10-01` | NOT_RUN |
| 04-10-02 | 3 | OPS-02 | T-04-10-01 | Old complete backup survives every injected failure; failed snapshots never refresh recoverable age; two trigger calls yield one complete publication. | `npm run test:server -- server/storage/backup.test.ts -t @04-10-02` | NOT_RUN |
| 04-11-01 | 4 | OPS-01, OPS-02, SAVE-02 | T-04-11-01 | 31-day boundary, duplicate start, missed timer,restart,backward clock,destination failure and stale baseline all give exact expected health/retention state. | `npm run test:server -- server/storage/backup-scheduler.test.ts` | NOT_RUN |
| 04-11-02 | 4 | OPS-01, OPS-02, SAVE-02 | T-04-11-01 | No document,image,title,grant,delete,create,import or duplication write commits after the bound; read/backup recovery paths remain available. | `npm run test:server -- server/storage/write-admission.test.ts` | NOT_RUN |
| 04-11-03 | 4 | OPS-01, OPS-02, SAVE-02 | T-04-11-01 | Every durable route including grant/revoke rejects stale backup coverage at commit time; renewed verified coverage restores admission and denied requests leave storage unchanged. | `npm run test:server -- server/storage/write-admission.test.ts` | NOT_RUN |
| 04-12-01 | 5 | OPS-02, SAVE-01, SAVE-02 | T-04-12-01 | Bad backup leaves target untouched; restored saved content/images/access relationships match; old sessions fail; new epoch rejects old browser work; old failed data is preserved. | `npm run test:server -- server/storage/restore.test.ts -t @04-12-01` | NOT_RUN |
| 04-12-02 | 5 | OPS-02, SAVE-01, SAVE-02 | T-04-12-01 | A cold authenticated member reopens restored content; expired restored cookies and denied grants cannot retrieve it; old client journal remains quarantined. | `npm exec playwright test -- tests/restored-board.spec.ts --project=prod --grep @04-12-02` | NOT_RUN |
| 04-13-01 | 5 | OPS-01 | T-04-13-01 | Container-native SQLite loads and opens file-backed WAL/FULL; production output starts only compiled server and static web; test-only provider/startup is excluded. | `docker build --target app -t dali-phase4-app:acceptance .` ; `docker build --target web -t dali-phase4-web:acceptance .` | NOT_RUN |
| 04-13-02 | 5 | OPS-01 | T-04-13-01 | Secure cookies survive legitimate TLS proxy; spoofed external forwarding cannot alter auth redirect/cookie policy; provider outage does not trigger liveness restart; graceful shutdown retains acknowledged data. | `npm run test:server -- server/preflight.test.ts` ; `node scripts/production-smoke.mjs --app-image dali-phase4-app:acceptance --web-image dali-phase4-web:acceptance` | NOT_RUN |
| 04-14-01 | 6 | OPS-01, OPS-02 | T-04-14-01 | Rendered manifest has one Recreate writer,explicit mounts/probes/security and external secret references; existing production smoke remains green before cluster execution. | `kubectl kustomize deploy/kubernetes/base` | NOT_RUN |
| 04-14-02 | 6 | OPS-01, OPS-02 | T-04-14-01 | Manifest checks fail for multiple writers,insecure exposure,missing mounts/probes; real smoke requires runtime-created board and image persistence across pod restart. | `node scripts/deployment-smoke.mjs --check-manifests` | NOT_RUN |
| 04-15-01 | 9 | SAVE-01, SAVE-02, OPS-01, OPS-02 | T-04-15-01 | Dataset has measured counts/bytes and semantic canaries; restoring from backup rather than browser cache produces exact reference/hash matches and current role access. | `npm run test:server -- server/storage/operations-drill.test.ts -t @04-15-01` | NOT_RUN |
| 04-15-02 | 9 | SAVE-01, SAVE-02, OPS-01, OPS-02 | T-04-15-01 | Real images+cluster+independent storage satisfy declared recovery envelope; absent environment or missing timed evidence returns nonzero and retains blocked acceptance. | `node scripts/recovery-drill.mjs --context "$DALI_ACCEPTANCE_CONTEXT" --namespace dali-recovery-acceptance --synthetic --report "$DALI_ACCEPTANCE_REPORT"` | NOT_RUN |
| 04-15-03 | 9 | SAVE-01, SAVE-02, OPS-01, OPS-02 | T-04-15-02 | Actual freshness503 preserves browser document/image work through simulated24hour maintenance; verified renewed coverage plus fresh authorization and exact acknowledgment are required before Saved. | `npm exec playwright test -- tests/backup-fence.spec.ts --project=prod --grep @04-15-03` | NOT_RUN |
| 04-16-01 | 10 | SAVE-01, SAVE-02, OPS-01, OPS-02 | T-04-16-01 | All36 named groups select and execute in each applicable engine; any missing group,required skip or zero test count is failure. | `npm exec playwright test -- tests/recovery-ui-matrix.spec.ts tests/local-recovery.spec.ts tests/recovery-archive.spec.ts tests/recovery-navigation.spec.ts tests/library-recovery.spec.ts --project=prod --project=prod-firefox --project=prod-webkit` | NOT_RUN |
| 04-16-02 | 10 | SAVE-01, SAVE-02, OPS-01, OPS-02 | T-04-16-01 | Acceptance report distinguishes implemented evidence,manual observations and blocking gaps; requirements become eligible for verifier only after their real gates pass. | `npm run typecheck && npm run typecheck:server` ; `npm test && npm run test:server && npm run build && npm run test:access && npm run test:browser` | NOT_RUN |

Failure direction is immediately paired with every automated command in each PLAN. Unit/server/browser: nonzero exit,zero selection,required skip. Production smoke requires IMAGE_SMOKE_PASS; manifest checks require MANIFEST_CHECK_PASS and provide static evidence only; actual deployment requires DEPLOYMENT_SMOKE_PASS; real drill requires RECOVERY_DRILL_PASS with complete threshold/hash report.

## Fixture Creation and Consumers

| Producer task | New fixture or suite | Consuming slices |
|---|---|---|
| 04-01-01 | tests/durability-fixtures.ts,server/testing/durability-child.ts,tests/durable-restart.spec.ts; file-backed restart/IPC/cold identity | 01-02,05,11,12,15 |
| 04-02-01 | server/boards/recovery.test.ts; epoch and commit barriers | 02-02/03 |
| 04-03-01/02 | native IDB version2/legacy/quota/two-tab cases in tests/local-recovery.spec.ts | 04,16 |
| 04-04-01/03 | recovery.test.ts,tests/recovery-fixtures.ts; timers,scope,pause,focus and E4 | 05,08,15-03,16 |
| 04-05-01/02 | save-status.test.ts,tests/save-status-fixtures.ts,tests/save-status.spec.ts; exact ack barriers | 07,15-03,16 |
| 04-06-01/02 | recovery-archive.test.ts,tests/recovery-archive.spec.ts,tests/recovery-archive-fixtures.ts; native import/hash oracle | 07,16 |
| 04-07-01 | tests/save-details.spec.ts,tests/save-details-fixtures.ts; E1/E2 and actual archive control | 07-02,16 |
| 04-08-01/02 | title-intent.test.ts,tests/recovery-navigation.spec.ts; actual destination/native warning | 16 |
| 04-09-01 | pending-recovery.test.ts,tests/library-recovery.spec.ts,tests/library-recovery-fixtures.ts; authorized50cards | 09-02,16 |
| 04-10-01 | backup.test.ts; actual SQLite backup,digest,document/image graph | 10-02,11,12,15 |
| 04-11-01/02/03 | backup-scheduler.test.ts,write-admission.test.ts; injected clock,real503 and complete durable-route admission | 12,15,16 |
| 04-12-01/02 | restore.test.ts,tests/restored-board.spec.ts; operator-selected fresh target,new epoch and access ledger | 15,16 |
| 04-13-02 | scripts/production-smoke.mjs; owned containers/TLS/OIDC and native binding | 14,15 |
| 04-14-02 | scripts/deployment-smoke.mjs; static validator plus explicit disposable-cluster mode | 15 |
| 04-15-01/02 | server/testing/recovery-dataset.ts,operations-drill.test.ts,operational-recovery.spec.ts,scripts/recovery-drill.mjs | 16 and verifier |
| 04-15-03 | tests/backup-fence.spec.ts; real freshness503 through completed recovery/status fixtures and exact pending acknowledgment | 16 and verifier |
| 04-16-01 | tests/recovery-ui-matrix.spec.ts;36exact surface/category assertions | final requirement verification |

Existing unit pattern doubles are not native IDB proof; actual file-backed process restarts are required for SAVE-01. Each new browser suite is registered at creation when needed and the complete named-project selection is checked in04-16-01. Synthetic provider identity remains stable across service restart and different browser cookie jars; owner/editor/viewer/denied identities are distinct. Crash tests observe transaction/ack boundaries without production bypass routes.

## Wave 0 Requirements

- File-backed spawned-server crash fixture with commit/ack barriers and fresh-browser cold reopen.
- Native IndexedDB abort/quota/corruption, exact acknowledgment and cross-account/epoch fixtures.
- Recovery UI/archive fixtures and all 36 surface/category assertions from approved UI-SPEC.
- Deterministic backup/retention clocks plus real I/O, synthetic dataset and restore harness.
- Register new browser suites in Playwright selection; isolate test ports and keep running user services intact.

## Manual-Only and Environment Verifications

Native navigation-warning display and native browser zoom need real-browser observation. Operator storage/failure-domain, TLS and cluster prerequisites require private environment confirmation. A working container daemon, reachable dependency registry and disposable Kubernetes cluster are execution prerequisites. Rendering manifests does not prove deployment. Actual provider acceptance and screen-reader speech remain approved backlog items.

Use the research's synthetic 50-board, three-identity dataset, 128 MiB images and object canaries. Measure acknowledged-to-recoverable freshness <=1 hour, retention30days and failure-to-verified-service <=24hours. Ordinary restart preserves every acknowledged change. Planned maintenance allowance24hours is separate. Archive import must compare actual content/image hashes.

## Validation Sign-Off

- [ ] Each task has an automated check with observable failing direction or explicit fixture dependency.
- [ ] No three consecutive tasks lack automated feedback.
- [ ] Fixtures precede consuming tests; no required skips or empty selections.
- [ ] All 36 UI truths and 15 context decisions have evidence mapping.
- [ ] Real restart, deployment and restore gates pass with measured evidence.
- [ ] Timing budgets measured; no watch-mode commands.

Approval: pending execution and validation; this document defines planned checks.
