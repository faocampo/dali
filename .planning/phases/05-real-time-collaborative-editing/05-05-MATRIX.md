# 05-05 acceptance coverage — work in progress

This matrix tracks the approved plan's remaining acceptance, not new scope or a completion claim. The execution report contains revision-scoped counts and retained failures. All fixtures use synthetic identities/data. Plan 05-05 remains open until the unresolved rows have sufficient runtime evidence.

| Obligation | Current evidence | Remaining work |
|---|---|---|
| Separate local candidate from changed shared content | Native active/reopened disjoint and legacy cases; no replay and unchanged local meaning; dismissal/review retains candidate | Retain in final integrated gate |
| Reconcile exact own receipts | Server account/tab/document/digest checks; native lost original/replay ACK cases | Retain negative ownership cases |
| Replay unchanged candidate with fresh reservations and transactional version check | Native unchanged/active replay, convergence, undo/redo, fresh gesture and reopen; server atomic CAS | Native images with unchanged/divergent recovery pass; server image CAS and epoch races pass; retain in final matrix |
| Changes after comparison or during commit | Two deterministic native remote-write races and server transaction races | Retain in final matrix |
| Pending and acknowledged titles | Three native title cases, exact server rename proof and atomic per-tab cleanup | Retain in final matrix |
| Restored write permission requires choice | Native previously recorded loss/restoration; consent bound to marker version and candidate tab | Four late-loss native cases pass; resumed native editing/reopen also verified at the commit boundary |
| Concurrent tab candidates remain distinct | Journal/title unit partitioning and scoped receipt proofs | Two native same-account sequential/simultaneous cases pass; retain in final browser matrix |
| Account/generation change cancels callbacks | Coordinator/source tests reject stale scope and late replies | Native held-response navigation and account change pass; retain in final browser matrix |
| Epoch and restored-server fences | Server baseline rejects wrong epoch; existing generic recovery tests | Native collaborative candidate across actual SQLite backup/restore passes; retain epoch commit-boundary checks |
| Storage failures retain bytes and pause mutation | Native local quota case and journal/title atomicity tests | Post-commit quota case passes after deferred native-sync restart; retain in final matrix |
| Already-open outage editing | Two consecutive native local gestures; zero remote reservations/pushes; unchanged/divergent reconnect; native known expiry and quota safeguards | Current increment passes 12 cross-browser outage/race cases and the 33-case integrated Chromium gate |
| Presence/permission metadata alone is not canvas divergence | Canonical baseline ignores unrelated revision changes | Native cursor heartbeat plus actual grant API revision passes with unchanged document bytes |
| Recovery UI keeps pending state and reachable controls | Native no-Saved assertions; heading focus, dismissal/review and narrow dialog gutters | Retain in final matrix; latest/private-copy actions belong to 05-06 |

Whole-phase load, active-access transitions and mind-map acceptance remain in 05-07 through 05-09. The separate actual-provider, independent-storage, native-system interaction and assistive-technology exceptions remain unchanged.
