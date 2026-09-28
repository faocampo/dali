# Phase 4 prerequisite regression refresh

Updated: 2026-09-28T07:04:29Z
Status: **needs_human — autonomous retry ceiling reached**
Current source/test revision: `348de1859bf1065ca6e01d2949b907db4203fe90`.

The original cold Viewer recovery defect passes in all three production browser engines: two restored boards per engine, six scenarios, with native content, decoded images, zero browser mutations and unchanged server state. The complete prerequisite regression remains unaccepted because the latest full run failed two synthetic fixture cases. Both fixture corrections now pass focused validation; a successful full gate on the corrected revision remains outstanding.

## Latest complete browser run

Revision: `5388e7b03ae7b7f242e0820b1afd0110312ac99b`.
Command: `PLAYWRIGHT_BROWSERS_PATH=<existing-browser-cache> npm run test:browser`.
Single worker; 1,960 selected; **1,958 passed, two failed, zero skipped**, approximately 1.6 hours. The command built production assets.

| Project | Passed | Failed |
|---|---:|---:|
| Development Chromium | 463 | 0 |
| Production Chromium | 457 | 0 |
| Production Firefox | 455 | 2 |
| Production WebKit | 457 | 0 |
| Access Chromium | 126 | 0 |

Failures and corrections in `348de18`:

1. `board-roles.spec.ts`, Editor native editing: fixture navigation replaced the account before the original canvas mounted, cancelling bundled font loads in Firefox. Wait for the original native canvas mount before changing accounts. Strict console assertions remain enabled.
2. `session-recovery.spec.ts`, delayed image: the barrier expected every matching request to remain authorized during cookie replacement, including later requests legitimately returning 401. Capture and delay exactly the original authorized response; subsequent requests follow ordinary authorization. Preserve stale-content, server-state and request-cancellation assertions.

## Corrected-revision validation

- Both client and server TypeScript checks passed after the final fixture changes.
- `npm exec playwright test -- tests/board-roles.spec.ts tests/session-recovery.spec.ts --project=dev --project=prod --project=prod-firefox --project=prod-webkit --grep 'native creation typing|delayed .* from old cookie'`: **20 passed, zero skipped**, 1.7 minutes.
- `npm exec playwright test -- tests/board-roles.spec.ts tests/session-recovery.spec.ts --project=prod-firefox --grep 'editor native creation typing|delayed image from old cookie' --repeat-each=5`: **10 passed, zero skipped**, 1.4 minutes.
- An intermediate fixture edit incorrectly limited the barrier to GET, excluding POST document reads: **16 passed, four failed**. Removing that method restriction produced the passing final results above.
- Complete client units: **233/233**; serialized server tests: **311/311**, including actual representative backup/restore I/O, on application revision `5388e7b`. The subsequent commit changes only browser fixtures.
- Earlier focused deferred-measurement/quota validation: **16/16** across four projects. A separate **65-context WebKit authentication check passed**. The latest complete run also passed those formerly failing lifecycle cases.

Focused passes establish the stated corrections. They do not convert the failed full run into a passing gate. The named standalone `npm run test:access` and full `npm run test:browser` gate on the corrected revision remain pending.

## Retry history and stopping condition

| Attempt | Observed result | Correction |
|---|---|---|
| `a3a8020` | 1,921 passed, 19 failed, zero skipped | Recovery keyboard isolation, disposed retries, native acknowledgment and synthetic browser fixture corrections |
| `e906986` | 437 passed, two failed, one interrupted, 1,500 not run | Transaction revision receipts, durable title-intent advancement and focus ownership |
| `d0958e1` | 1,810 passed, two failed, 136 not run | Deferred native measurement fencing and shared WebKit context isolation |
| `5388e7b` | 1,958 passed, two failed, zero skipped | Account-transition fixture corrections in `348de18`; 30 focused/repeated cases now pass |

The invoked autonomous workflow requires a terminal `needs_human` halt after three unsuccessful fix-and-retry attempts at the same step. No further full-suite retry is started automatically. Canonical Phase 1–3 verification retains its historical acceptance evidence and stale fingerprints; this record adds no new human UAT requirement.

## Resume boundary

Review the recorded retry history, then resume with `$gsd-autonomous --from 4` to run the remaining corrected-revision gate and refresh canonical prerequisite fingerprints. Continue with 04-15 reconciliation and 04-16 only after that gate passes. Phase 4 remains **14/16 plans complete**, with requirements unaccepted. Existing user deferrals remain: actual provider 999.4, assistive-technology speech 999.3, and independent storage/capacity 999.6.

The retained local Kubernetes image has not been redeployed with subsequent corrections; its measurements remain tied to its recorded revision. Public acceptance records use synthetic data and omit private operational artifacts. Unrelated working-tree changes are preserved.
