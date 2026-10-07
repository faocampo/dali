# Phase 4 prerequisite regression refresh

Updated: 2026-09-28T14:45:49Z
Status: **passed — complete corrected-source regression verified**
Current source/test revision: `5aefe81d00ca618c2985c8a4801131cdcb6044e6`.

The final full gate passed **1,960/1,960, zero failures or skips**, in 1.8 hours. Standalone access passed **126/126**. Both static checks passed after the final changes. Phase 1–3 canonical fingerprints were refreshed and each verification.status query returns **passed**. Earlier failed runs below remain historical.

The previous retry-ceiling halt below was superseded by the user's explicit `$gsd-autonomous --from 4` invocation. The resumed attempt and its corrections are recorded at the end.

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

## Explicit resumed attempt — 2026-09-28

At `e6466eb`, standalone access passed **126/126**. The resumed full browser matrix was interrupted after Firefox reported failures: **1,398 passed, two failed, one interrupted, 559 not run**. Development Chromium passed 463/463; production Chromium passed 457/457; Firefox passed 455 and failed two; WebKit passed 23 before interruption. The interrupted WebKit authorization case is not evidence of a product failure. No prerequisite acceptance or fingerprint is advanced from this incomplete run.

The failures have distinct fixture causes:

- The save-status retry test restored network success before native image hydration observed the injected failure. Call-stack instrumentation reproduced this race (four passes, one failure) and distinguished preservation, native image loading, and recovery verification. Waiting for the native error state before restoring transport retains the original single-retry assertion. Corrected validation passed **20/20** over four browser projects, five repetitions each.
- The delayed-image account-switch case completed its security assertions, then failed the strict error collector on the source's stale-lifetime cancellation. The fixture now tracks this exact error alongside transport aborts and permits it only after the deliberately injected identity change. Repeated cross-browser validation passed **36/36** over four projects, three repetitions of each delayed-resource scenario. Stale content, aborted requests, page errors, rejected writes and unchanged server-state checks remain intact.

Both TypeScript checks passed after these fixture corrections. Application source remains unchanged. A complete passing corrected-source gate remains required before Phase 4 acceptance reconciliation.

Corrections committed in `5aefe81`. A fresh complete one-worker `npm run test:browser` gate is running on that revision. Standalone access previously passed 126/126 in this resumed run; the full matrix also includes the access project. No acceptance is advanced while the full gate is pending.

## Final passing gate

`5aefe81d00ca618c2985c8a4801131cdcb6044e6`: `npm run test:browser` passed **1,960 selected / 1,960 passed / zero failed / zero skipped**, approximately 1.8 hours. Development Chromium: 463; production Chromium: 457; Firefox: 457; WebKit: 457; access Chromium: 126. The command built production assets and ran one worker. The original cold Viewer regression passes in every production engine, including both board scenarios per engine.

`npm run test:access`: **126/126** earlier in this resumed run. Both TypeScript checks passed after the final fixture edits. The unchanged application retains the recorded 233/233 client-unit and 311/311 serialized-server results at `5388e7b`. The final fixture corrections separately passed 20 image-retry and 36 account-transition cases. The prior retry halt and stale canonical prerequisite statuses are resolved by this complete gate. Phase 4 final UI/native acceptance remains pending.
