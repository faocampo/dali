---
schema_version: 1
open_count: 11
waived_count: 2
fixed_count: 9
total_count: 22
last_updated: 2026-09-27T15:12:32.805Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | tests/community.spec.ts |  | Task 01-01 inherited working behavior; no intentional RED commit. Acceptance and harness negative controls passed. | open |  | 2026-09-11T18:29:50.302Z |  |
| 2 | 01 | unrun-verify | tests/image-import.spec.ts |  | File-manager OS drag and Firefox/WebKit OS clipboard integration remain unverified; browser DataTransfer and constructed ClipboardEvent routing are covered. | waived | User approved image import and copy/paste feature UAT. Individual native OS steps were not separately reported; acceptance and evidence limits are retained in 01-UAT.md. | 2026-09-11T19:32:09.374Z | 2026-09-12T20:47:14.821Z |
| 3 | 02 | unrun-verify | tests/mindmap-accessibility.spec.ts |  | Real 200 percent browser zoom remains for phase verification; desktop and narrow CSS zoom at 100 and 200 percent are automated separately. | open |  | 2026-09-12T23:48:17.167Z |  |
| 4 | 02 | unrun-verify | tests/mindmap-keyboard.spec.ts |  | Native OS IME text production remains for phase verification; constructed composition events verify topic routing and external-field isolation. | open |  | 2026-09-12T23:48:17.294Z |  |
| 5 | 02 | unrun-verify | tests/clipboard-route.ts |  | Firefox and WebKit native OS clipboard integration remains unverified; native serialized payload routing is simulated, while Chromium uses the real clipboard. | open |  | 2026-09-13T00:37:09.126Z |  |
| 6 | 03 | deviation | server/preflight.test.ts | 13 | Task 03-01 dependency installation began after observed RED but before RED evidence gate and test commit; baseline assertion was independently replayed and verified before GREEN commit. | open |  | 2026-09-16T13:09:29.543Z |  |
| 7 | 03 | stub | src/App.tsx | 28 | Authorized board transition awaits account canvas mounting in plan 03-06; permission is checked before displaying the canonical board title. | fixed |  | 2026-09-16T14:06:50.521Z | 2026-09-16T15:36:52.704Z |
| 8 | 03 | unrun-verify | tests/board-sharing.spec.ts |  | Native 200% browser zoom for sharing remains plan 03-12 acceptance; automated 490px viewport geometry is covered. | open |  | 2026-09-16T16:00:53.159Z |  |
| 9 | 03 | unrun-verify | tests/session-recovery.spec.ts |  | Native 200% browser zoom and actual OS IME or screen-reader speech for recovery remain plan 03-12 acceptance; automated 490px geometry, keyboard focus, constructed composition and reduced motion are covered. | open |  | 2026-09-16T17:51:23.432Z |  |
| 10 | 03 | unrun-verify | tests/local-board-import.spec.ts |  | Native 200% browser zoom and assistive-technology speech for local copy remain plan 03-12 acceptance; automated 490px geometry, keyboard focus and reduced motion passed. | open |  | 2026-09-16T19:01:59.856Z |  |
| 11 | 04 | deviation | tests/durable-restart.spec.ts |  | Used existing browser cache and loopback escalation for owned synthetic listeners; corrected test title and PNG fixtures; all required gates passed. | fixed |  | 2026-09-25T21:18:33.385Z | 2026-09-25T21:19:17.375Z |
| 12 | 04 | deviation | src/canvas/account/outbox.ts |  | Epoch integration required descriptor, journal, thumbnail, duplicate and explicit fixture-header changes; implemented and verified in plan 04-02. | fixed |  | 2026-09-25T21:44:43.562Z | 2026-09-25T21:44:49.417Z |
| 13 | 04 | deviation | src/canvas/account/outbox.ts |  | Plan 04-03 integrated runtime callbacks and fixture schema checks; corrected Yjs semantic coverage and preserved image loading feedback; final 44 browser cases pass. | fixed |  | 2026-09-25T22:17:37.399Z | 2026-09-25T22:17:42.532Z |
| 14 | 04 | deviation | server/storage/backup.ts |  | Plan 04-10 used the existing bundler for crash children, normalized snapshot journal mode and preserved legitimate duplicate/deletion receipts; all 22 backup tests pass. | fixed |  | 2026-09-25T22:36:39.393Z | 2026-09-25T22:36:44.145Z |
| 15 | 04 | deviation | server/app.ts |  | Bounded router parameter length expanded to support required pending-grant admission routes; all 95 route/time cases pass. | fixed |  | 2026-09-26T03:38:38.344Z | 2026-09-26T03:41:00.992Z |
| 16 | 04 | deviation | src/canvas/account/outbox.ts |  | Plan 04-05 connected journal acknowledgments and Header status to exact save coverage, and verified image-only retry through real server reads; 20 reducer and nine browser cases pass. | fixed |  | 2026-09-26T04:07:37.553Z | 2026-09-26T04:09:03.108Z |
| 17 | 04 | deviation | server/storage/restore.ts |  | Fixed future-dated selected backup publishing an unverifiable restore; final restore suite passes. | fixed |  | 2026-09-26T04:27:37.952Z | 2026-09-26T04:29:31.962Z |
| 18 | 04 | unmet-truth | scripts/deployment-smoke.mjs |  | Local Kubernetes deployment smoke passed; production ingress acceptance remains unverified. Independent storage/capacity validation deferred by the user to backlog 999.6. | open |  | 2026-09-26T19:33:30.654Z |  |
| 19 | 04 | unrun-verify | tests/save-details.spec.ts |  | Native browser UI 200% zoom remains a final phase acceptance check; 04-07 automated Chromium evidence uses CDP visual viewport scale 2 and narrow viewport reflow. | open |  | 2026-09-26T20:09:43.019Z |  |
| 20 | 04 | unrun-verify | scripts/recovery-drill.mjs |  | 04-15-02 local Kubernetes API recovery passed; independent physical failure-domain and production retention capacity acceptance remain open. | waived | User postponed independent storage and capacity validation on 2026-09-27 to backlog 999.6. Deferred from active Phase 4 acceptance; validation remains unverified. | 2026-09-26T20:58:18.534Z | 2026-09-27T15:12:32.805Z |
| 21 | 04 | unrun-verify | tests/backup-fence.spec.ts |  | 04-15-03 real backup-freshness HTTP rejection and exact replay passed in Chromium, Firefox and WebKit with a simulated 24-hour scheduler interval. | fixed |  | 2026-09-26T20:58:18.675Z | 2026-09-27T14:54:16.154Z |
| 22 | 04 | unmet-truth | src/canvas/account/board-workspace.ts |  | Cold restored Viewer opening fails. Automated tests/restored-viewer.spec.ts @04-15-22 reproduces both board types in Chromium, Firefox and WebKit (3 failed, zero skipped); write rejection and exact unchanged server state pass. Determine fixture normalization versus application defect and make this regression pass before native recovery acceptance. | open |  | 2026-09-27T15:03:54.812Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "tests/community.spec.ts",
    "line": null,
    "description": "Task 01-01 inherited working behavior; no intentional RED commit. Acceptance and harness negative controls passed.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T18:29:50.302Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "tests/image-import.spec.ts",
    "line": null,
    "description": "File-manager OS drag and Firefox/WebKit OS clipboard integration remain unverified; browser DataTransfer and constructed ClipboardEvent routing are covered.",
    "status": "waived",
    "reason": "User approved image import and copy/paste feature UAT. Individual native OS steps were not separately reported; acceptance and evidence limits are retained in 01-UAT.md.",
    "recorded_at": "2026-09-11T19:32:09.374Z",
    "resolved_at": "2026-09-12T20:47:14.821Z"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "tests/mindmap-accessibility.spec.ts",
    "line": null,
    "description": "Real 200 percent browser zoom remains for phase verification; desktop and narrow CSS zoom at 100 and 200 percent are automated separately.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-12T23:48:17.167Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "tests/mindmap-keyboard.spec.ts",
    "line": null,
    "description": "Native OS IME text production remains for phase verification; constructed composition events verify topic routing and external-field isolation.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-12T23:48:17.294Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "tests/clipboard-route.ts",
    "line": null,
    "description": "Firefox and WebKit native OS clipboard integration remains unverified; native serialized payload routing is simulated, while Chromium uses the real clipboard.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-13T00:37:09.126Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "03",
    "file": "server/preflight.test.ts",
    "line": 13,
    "description": "Task 03-01 dependency installation began after observed RED but before RED evidence gate and test commit; baseline assertion was independently replayed and verified before GREEN commit.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T13:09:29.543Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "stub",
    "phase": "03",
    "file": "src/App.tsx",
    "line": 28,
    "description": "Authorized board transition awaits account canvas mounting in plan 03-06; permission is checked before displaying the canonical board title.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-16T14:06:50.521Z",
    "resolved_at": "2026-09-16T15:36:52.704Z"
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "tests/board-sharing.spec.ts",
    "line": null,
    "description": "Native 200% browser zoom for sharing remains plan 03-12 acceptance; automated 490px viewport geometry is covered.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T16:00:53.159Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "tests/session-recovery.spec.ts",
    "line": null,
    "description": "Native 200% browser zoom and actual OS IME or screen-reader speech for recovery remain plan 03-12 acceptance; automated 490px geometry, keyboard focus, constructed composition and reduced motion are covered.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T17:51:23.432Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "tests/local-board-import.spec.ts",
    "line": null,
    "description": "Native 200% browser zoom and assistive-technology speech for local copy remain plan 03-12 acceptance; automated 490px geometry, keyboard focus and reduced motion passed.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T19:01:59.856Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "04",
    "file": "tests/durable-restart.spec.ts",
    "line": null,
    "description": "Used existing browser cache and loopback escalation for owned synthetic listeners; corrected test title and PNG fixtures; all required gates passed.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-25T21:18:33.385Z",
    "resolved_at": "2026-09-25T21:19:17.375Z",
    "milestone": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "04",
    "file": "src/canvas/account/outbox.ts",
    "line": null,
    "description": "Epoch integration required descriptor, journal, thumbnail, duplicate and explicit fixture-header changes; implemented and verified in plan 04-02.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-25T21:44:43.562Z",
    "resolved_at": "2026-09-25T21:44:49.417Z",
    "milestone": null
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "04",
    "file": "src/canvas/account/outbox.ts",
    "line": null,
    "description": "Plan 04-03 integrated runtime callbacks and fixture schema checks; corrected Yjs semantic coverage and preserved image loading feedback; final 44 browser cases pass.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-25T22:17:37.399Z",
    "resolved_at": "2026-09-25T22:17:42.532Z",
    "milestone": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "04",
    "file": "server/storage/backup.ts",
    "line": null,
    "description": "Plan 04-10 used the existing bundler for crash children, normalized snapshot journal mode and preserved legitimate duplicate/deletion receipts; all 22 backup tests pass.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-25T22:36:39.393Z",
    "resolved_at": "2026-09-25T22:36:44.145Z",
    "milestone": null
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "04",
    "file": "server/app.ts",
    "line": null,
    "description": "Bounded router parameter length expanded to support required pending-grant admission routes; all 95 route/time cases pass.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T03:38:38.344Z",
    "resolved_at": "2026-09-26T03:41:00.992Z",
    "milestone": null
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "04",
    "file": "src/canvas/account/outbox.ts",
    "line": null,
    "description": "Plan 04-05 connected journal acknowledgments and Header status to exact save coverage, and verified image-only retry through real server reads; 20 reducer and nine browser cases pass.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T04:07:37.553Z",
    "resolved_at": "2026-09-26T04:09:03.108Z",
    "milestone": null
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "04",
    "file": "server/storage/restore.ts",
    "line": null,
    "description": "Fixed future-dated selected backup publishing an unverifiable restore; final restore suite passes.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T04:27:37.952Z",
    "resolved_at": "2026-09-26T04:29:31.962Z",
    "milestone": null
  },
  {
    "id": 18,
    "kind": "unmet-truth",
    "phase": "04",
    "file": "scripts/deployment-smoke.mjs",
    "line": null,
    "description": "Local Kubernetes deployment smoke passed; production ingress acceptance remains unverified. Independent storage/capacity validation deferred by the user to backlog 999.6.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-26T19:33:30.654Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 19,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "tests/save-details.spec.ts",
    "line": null,
    "description": "Native browser UI 200% zoom remains a final phase acceptance check; 04-07 automated Chromium evidence uses CDP visual viewport scale 2 and narrow viewport reflow.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-26T20:09:43.019Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 20,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "scripts/recovery-drill.mjs",
    "line": null,
    "description": "04-15-02 local Kubernetes API recovery passed; independent physical failure-domain and production retention capacity acceptance remain open.",
    "status": "waived",
    "reason": "User postponed independent storage and capacity validation on 2026-09-27 to backlog 999.6. Deferred from active Phase 4 acceptance; validation remains unverified.",
    "recorded_at": "2026-09-26T20:58:18.534Z",
    "resolved_at": "2026-09-27T15:12:32.805Z",
    "milestone": null
  },
  {
    "id": 21,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "tests/backup-fence.spec.ts",
    "line": null,
    "description": "04-15-03 real backup-freshness HTTP rejection and exact replay passed in Chromium, Firefox and WebKit with a simulated 24-hour scheduler interval.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T20:58:18.675Z",
    "resolved_at": "2026-09-27T14:54:16.154Z",
    "milestone": null
  },
  {
    "id": 22,
    "kind": "unmet-truth",
    "phase": "04",
    "file": "src/canvas/account/board-workspace.ts",
    "line": null,
    "description": "Cold restored Viewer opening fails. Automated tests/restored-viewer.spec.ts @04-15-22 reproduces both board types in Chromium, Firefox and WebKit (3 failed, zero skipped); write rejection and exact unchanged server state pass. Determine fixture normalization versus application defect and make this regression pass before native recovery acceptance.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T15:03:54.812Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
