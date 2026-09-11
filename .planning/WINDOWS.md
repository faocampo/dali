---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-09-11T19:32:09.374Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | tests/community.spec.ts |  | Task 01-01 inherited working behavior; no intentional RED commit. Acceptance and harness negative controls passed. | open |  | 2026-09-11T18:29:50.302Z |  |
| 2 | 01 | unrun-verify | tests/image-import.spec.ts |  | File-manager OS drag and Firefox/WebKit OS clipboard integration remain unverified; browser DataTransfer and constructed ClipboardEvent routing are covered. | open |  | 2026-09-11T19:32:09.374Z |  |

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
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T19:32:09.374Z",
    "resolved_at": null
  }
]
````
