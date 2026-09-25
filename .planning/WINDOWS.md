---
schema_version: 1
open_count: 8
waived_count: 1
fixed_count: 2
total_count: 11
last_updated: 2026-09-25T21:19:17.375Z
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
  }
]
````
