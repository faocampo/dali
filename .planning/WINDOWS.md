---
schema_version: 1
open_count: 5
waived_count: 1
fixed_count: 0
total_count: 6
last_updated: 2026-09-16T13:09:29.543Z
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
  }
]
````
