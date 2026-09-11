---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-11T18:29:50.302Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | tests/community.spec.ts |  | Task 01-01 inherited working behavior; no intentional RED commit. Acceptance and harness negative controls passed. | open |  | 2026-09-11T18:29:50.302Z |  |

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
  }
]
````
