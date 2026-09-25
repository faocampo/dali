---
phase: 03-okta-and-board-access
plan: "12"
status: incomplete
automated_task: passed-at-7341672
actual_provider: deferred-backlog-999.4
human_acceptance: accepted-with-approved-deferrals
---

# Phase 3 Plan 12 acceptance checkpoint

The automated gate for task 03-12-01 passed on source/test revision `73416723411ca2c5b98de090f6d5327ed9e076c7`. Plan 12 and Phase 3 remain incomplete with **the refreshed final automated gate pending; all human acceptance items have dispositions**. Current dispositions are **7 passes and 3 skips**: actual-provider acceptance is deferred to backlog 999.4, assistive-technology acceptance to 999.3, and the removed optional local-copy workflow is waived. Progress remains **2/13 accepted phases**, **25/26 completed plans**, and **11/12 Phase 3 plans**. Independent verification remains **human_needed**, with its historical 99/104 score preserved. [03-UAT.md](03-UAT.md) (current acceptance checklist) is authoritative over the historical obligations below.

## Current final-gate refresh — 2026-09-24

After the user's item 8 pass, the full blocking chain was started against application/test revision `601b588` (the subsequent `bcee05f` commit records human acceptance only). Frontend/server typechecks, **110/110 unit tests**, **116/116 server tests**, and the production build passed. The standalone access project completed **124 cases: 113 passed, 11 failed, zero skipped**, in 468.8s. The chain stopped on that failure; the full browser matrix did not start.

All eleven failures were traced to assertions predating approved UI/role changes: an exact session-key list omitted `systemRole`; five cases searched exact visible `Saved` text before elapsed time was added; four board-action cases expected the previous danger color, header-visible roles, or the previous tab order; one Viewer import case expected superseded explanatory copy. The pending test-only correction retains sign-out, canary preservation, source bytes, role denial, disabled-action, focus-return and keyboard-navigation oracles. No application code, timeout, project selection or error allowance is changed. Focused rechecks and a fresh complete gate remain required.

The first correction recheck passed **30/33 cases** across Chromium, Firefox and WebKit in 117.0s. The three failures were the same long-title header test reaching its later geometry oracle. Source inspection exposed controls reduced below 44px and an unconstrained inline-title wrapper at narrow widths. Restoring target heights alone passed 3/6 focused cases (34.7s) and the improved geometry diagnostics isolated the remaining title overflow. The wrapper now has an explicit available-width bound; fresh responsive validation passed **18/18 cases** across Chromium, Firefox and WebKit (63.6s), covering long Unicode titles, 390/768/1456px library/editor layouts and 390/1456px sharing layouts. Fresh narrow-screen WebKit header and Chromium sharing captures were inspected; source controls remain within the viewport. The complete final gate is still pending. These are bounded UI regressions identified by the final gate, separate from the initial stale test expectations.

## Regression refresh at `e1f0cd5` — 2026-09-24

The corrected gate passed both typechecks, 110 unit tests, 116 server tests, the production build and **124/124 standalone access cases** (264.3s). Its 1,642-case full browser run exposed five development regressions: four connector-label height changes after reload and one narrow, magnified mind-map inspector dismissal failure after changing font size. The run was intentionally interrupted after the development project completed, before repeating known failures in every engine. Final status: **470 passed, 5 failed, 1 interrupted, 1,166 unrun** in 905.9s. Development: 379 passed/5 failed; production Chromium: 91 passed/1 interrupted/286 unrun; Firefox and WebKit: 378 unrun each; access: 124 unrun. These results block closure; the prior standalone access pass does not substitute for the remaining full run.

The source/test manifest remained frozen throughout this attempt. Font-loading and inspector-focus corrections require focused validation followed by a new complete gate. Human acceptance remains seven passes and three approved skips.

The regression correction loads bundled fonts before native editor construction, preventing permanent fallback line-height caching. Public font faces remain shared for the document lifetime; a 15-second failure boundary clears the failed attempt and exposes the existing retry screen. Native per-editor font loading is removed to avoid reintroducing unloaded duplicate faces. The mind-map inspector now sits above the canvas toolbar: event tracing showed a font-size blur moving that toolbar over the Close button between pointer-down and pointer-up. Existing geometry, keyboard, contrast, undo/redo and persistence assertions remain intact. **76/76 focused cases** passed across development Chromium, production Chromium, Firefox and WebKit (153.2s), followed by **8/8 delayed-font/timeout-retry cases** (65.3s). The frontend static check passed; the complete gate remains pending.

## Panel interaction correction at `b4755ab` — 2026-09-24

The next complete chain again passed both typechecks, 110 unit tests, 116 server tests, production build and **124/124 standalone access cases** (269.9s). Its full matrix reached **371 passes, 1 timeout, 1 interrupted and 1,277 unrun** in 746.9s before deliberate interruption. The timeout in the daily mind-map workflow exposed an interaction introduced by the panel fix: mind-map properties at layer 20 covered the subsequently opened Layers inspector, which still used layer 14. Pointer interception prevented selecting a layer. The original five regressions passed in this attempt. The correction moves the shared inspector layer above native canvas formatting, retaining document-order precedence for the later Layers panel. The existing daily workflow reproduces this error; its click is not forced or bypassed. Cross-engine panel, navigation and arrangement checks and another fresh full gate are required before closure.

The shared-layer correction passed the frontend static check, **88/88 panel/navigation/daily-workflow cases** across all four browser modes (195.1s), and **60/60 adjacent native arrangement cases** (127.7s). The layer-order fix changes the common inspector rule; Layers retains its later DOM precedence over mind-map properties, and both stay above the native formatting toolbar. No test force-click, timeout change or assertion removal was used. Another complete gate is required on this final source.

## Complete matrix at `f8e87db` — 2026-09-25

Both typechecks, 110 unit tests, 116 server tests, build and 124 standalone access tests passed. The complete browser matrix finished **1,649 passed / 1 failed / 0 skipped / 0 interrupted / 0 unrun** in 3,791.2s (63.2m). Development passed 386/386; production Chromium 380/380; Firefox 379/380; WebKit 380/380; the access project 124/124. All 190 frozen tracked source/test/configuration hashes matched at completion. The sole failure was Firefox `board-title.spec.ts`: saving with Enter updated the title, but focus did not return to the title button. Every prior header, font, inspector and Layers regression passed. This remains a failed gate; focused event tracing and a subsequent fresh gate are required before completion.

Firefox event tracing reproduced the focus race on rename 87 in a 400-rename stress attempt (51.5s including the failed 20-second focus assertion). A preceding 40-rename diagnostic passed. Firefox delivers blur from the disabled input asynchronously; when that blur arrives after the save promise settles but before React removes the field, the blur handler clears the Enter-key focus-return flag. The correction marks the closing transition synchronously and ignores its late blur, preserving ordinary blur-save and cancellation behavior. The same instrumented **400-rename sequence passed** after the fix (62.2s total; 43.3s case execution). Diagnostic instrumentation remains outside committed tests; a bounded 40-rename browser regression retains the focus and reload-persistence oracles.

The final title correction passed the frontend static check and **28/28 focused title/role/recovery cases** across development Chromium, production Chromium, Firefox and WebKit (84.7s). Existing Enter, Escape, blur-save, composition, uncertain-operation, responsive header, source-persistence and canvas-lifetime checks remain unchanged. The next blocking run includes the new repeated-rename regression in all four general browser projects.

## Cancelled editor lifecycle at `e5a0739` — 2026-09-25

Both typechecks, 110 unit tests, 116 server tests, build and 124 standalone access tests passed. The next complete matrix found an intermittent duplicate editor during rapid board switching and was deliberately stopped before modifying source: **332 passed, 1 failed, 1 interrupted, 1,320 unrun** in 562.2s. The strict singleton locator observed two native hosts while the board was opening. This attempt remains failed evidence.

A new observational regression reproduced the defect deterministically: a document mutation observer saw a maximum of two attached editor hosts during development StrictMode setup. Cancellation was previously checked only after asynchronous mounting finished. The correction binds mounting to the supplied authorized runtime, checks cancellation and scope after font loading, and immediately disposes an in-progress view on cancellation. Completed handles retain idempotent cleanup; setup failures release installed listeners and guards. The singleton, board-identity, saved-content and recovery assertions remain intact. Focused multi-engine validation and a fresh full chain are required before closure.

The correction passed both static checks and **144/144 focused browser cases** across development Chromium, production Chromium, Firefox and WebKit (427.3s), with zero failures, skips or retries. This includes the new attachment-count regression, interrupted switching with exact board IDs/content, delayed-font timeout/retry and all session-recovery scenarios. A fresh complete gate remains required.

## Current pending-access review — 2026-09-24

Resumed through `$gsd-progress --next` at revision `5c7fe7a`. Phases 1 and 2 have matching plan/summary counts; 03-12 is the first incomplete plan. Previously approved deferrals remain effective.

Fresh focused evidence: **3/3 browser cases** passed in Chromium, Firefox and WebKit (31.0s), exercising an owner granting pending Viewer access, acknowledged presentation and revocation. **16/16 grant server tests** passed (2.61s), including trusted first sign-in activation, revoked pending grants and rejected ambiguous/unverified identities. Commands: `npx playwright test tests/board-sharing.spec.ts --grep 'owner grants pending Viewer' --project=prod --project=prod-firefox --project=prod-webkit --trace=on` and `npm run test:server -- server/boards/grants.test.ts`.

Reviewed the synthetic browser capture: the row says **Pending member sign-in**, the acknowledgment says **Pending access added.**, and the explanation says **Access starts after this person signs in with a verified internal account.** The action is **Grant access**. This is fresh scoped evidence for the wording and pending-grant behavior; the user subsequently replied "pass" for item 8. No actual-provider acceptance or new full-phase gate is claimed. Synthetic runtime captures remain outside tracked content.

The user explicitly accepted this wording. UAT now records seven passes and three approved skips, with zero pending items. A fresh final automated gate is required before Phase 3 completion because subsequent UI and import changes postdate the historical full-suite run.

The sections below retain historical execution evidence and original obligations at their stated revisions.

## Local development startup correction — 2026-09-17

A subsequent user report exposed an omitted development service: the documented `npm run dev` launched only Vite, whose authentication proxy targeted a separately started test backend. Unsigned session lookup and sign-in initiation both returned empty HTTP 500. Existing browser tests supplied that backend independently and therefore missed the ordinary startup path.

Source revision `2d0dae437499830adc1d4a142d1765a30b5cf52d` adds complete loopback development startup, explicitly labeled signed synthetic OIDC, the real application backend, persistent private local state, coordinated shutdown and a separate raw-Vite `dev:ui` command. Development and preview now use an explicit generic proxy target. Production authentication and board authorization remain unchanged. See [resolved startup journal](../../debug/resolved/local-sign-in-startup.md) (root cause, implementation and regression evidence) and [README](../../../README.md) (local startup instructions).

Validation for this correction: **4/4** actual-command startup cases (21.17s), including signed sign-in, saved board content after restart, retained sessions, authorization, port collisions, invalid configuration and cleanup; **63/63** adjacent OIDC/preflight tests (7.32s); frontend/server typechecks, development compilation and syntax/whitespace checks passed. The existing development/production-preview authentication runner passed **4/4** callback-recovery and ordinary-entry/logout cases (22.8s), including a fresh production build. A controlled revert reproduced both HTTP 500 responses; reapplication restored HTTP 401 for unsigned session lookup and HTTP 302 for sign-in start. The live in-app browser completed local sign-in and displayed the authenticated board library and local-copy control.

The full 1,533-case gate below remains evidence for `7341672`; it was not repeated for this bounded development-only correction. Actual-provider and native acceptance remain pending, with all ten UAT items unchanged. Phase 3 stays in progress.

## Final automated evidence — 2026-09-17

Fresh synthetic services executed the exact two-file production smoke, followed sequentially by all seven blocking commands. All five configured projects ran without a filter, required skip, changed timeout or weakened assertion. Source and tests remained frozen during execution.

| Command / scope | Result |
| --- | --- |
| Exact production `@03-12-smoke` | 2/2 passed, 27.374s |
| `npm run typecheck` | Passed in smoke and blocking chain |
| `npm run typecheck:server` | Passed |
| `npm test` | 105/105 passed, 12 files, 1.28s |
| `npm run test:server` | 112/112 passed, 7 files, 7.68s |
| `npm run build` | Passed, 8.67s; existing build warnings retained |
| `npm run test:access` | 123/123 passed, 256.485s (4.3m) |
| `npm run test:browser` | **1533/1533 passed**, 44 files, 3426.487s (57.1m) |

| Full-matrix project | Selected / passed | Failed / timed out / skipped / interrupted / unrun | Sum of case execution time |
| --- | ---: | --- | ---: |
| dev | 357 / 357 | 0 / 0 / 0 / 0 / 0 | 558.849s |
| prod | 351 / 351 | 0 / 0 / 0 / 0 / 0 | 573.095s |
| prod-firefox | 351 / 351 | 0 / 0 / 0 / 0 / 0 | 1075.242s |
| prod-webkit | 351 / 351 | 0 / 0 / 0 / 0 / 0 | 932.604s |
| access | 123 / 123 | 0 / 0 / 0 / 0 / 0 | 250.578s |

Case-time sums exclude runner setup/teardown and are not per-project wall-clock durations. The outer command exited zero. An additive artifact reporter captured every status and annotation; final claims were checked against the entire run, not the latest console lines. Ignored synthetic evidence is retained in `.gsd/acceptance-03-guarded-ui-7341672/1789646405743-1533/`; standalone access captures are in the sibling `1789646148570-123/` directory. Runtime logs remain outside publishable history.

Five `bfcache-observation` annotations each report **ordinary history reload**. Genuine persisted BFCache restoration remains unobserved. Non-Chromium clipboard cases retain their explicit native-handler payload-transport/OS-integration limitations. Native browser 200% zoom, native OS IME, assistive-technology speech and actual-provider acceptance remain unverified. Synthetic screenshots and CSS-zoom checks do not establish those observations.

### Final readiness correction and host-interrupted attempt

Test-only commit `7341672` adds exact singleton readiness at three native reload sites, waits for authenticated library cards and actual authorized preview images before synthetic setup replaces the document, and waits for the existing Saved acknowledgement before the fill-persistence reload. Persisted IDs/model/content, real session expiry, deep-link destinations, canaries, strict console/page-error collectors and protected-pixel assertions remain intact. No production file, project selection or default error allowance changed.

The library timing diagnosis reproduced WebKit cancellation errors with 24 synthetic previews and immediate heading-only navigation. The normal visible card-link click and navigation after all previews rendered both passed (2/2, 23.6s). The affected unchanged behavioral checks then passed in all four modes: 48 cases plus four populated-library preludes, **52/52 in 2.2m**. An earlier focused launcher stopped before any test because the temporary seed retained an unused variable; that diagnostic-only variable was removed. Temporary diagnostics were removed before the committed inventory was refreshed.

The first full run at `7341672` was interrupted after repeated setup timeouts. It selected 1533 cases and ran for 35808.407s (9.9h):

| Project | Passed | Failed | Timed out | Interrupted | Unrun |
| --- | ---: | ---: | ---: | ---: | ---: |
| dev | 357 | 0 | 0 | 0 | 0 |
| prod | 326 | 1 | 24 | 0 | 0 |
| prod-firefox | 127 | 3 | 12 | 1 | 208 |
| prod-webkit | 0 | 0 | 0 | 0 | 351 |
| access | 0 | 0 | 0 | 0 | 123 |
| Total | **810** | **4** | **36** | **1** | **682** |

The earliest failure was the production long-library rename setup waiting for `Your boards`, with `Signing you in…` still displayed. Its 926.710s duration aligned with a 926s host sleep interval; repeated failures followed repeated sleep/wake cycles. Raw host diagnostics remain outside the repository. Tail-only interim green claims missed prior failures and were withdrawn; the full status aggregate above is authoritative. This attempt remains failed/interrupted evidence.

The exact 40 failed/timed-out project-qualified cases plus two populated-library preludes passed unchanged under a foreground-command idle-sleep guard: **42/42, 141.377s (2.4m)**. The subsequent fresh smoke and full gate above used the same scoped `/usr/bin/caffeinate -i` guard. Its process and idle-sleep assertion were verified during execution and automatically released on teardown. Global power settings were unchanged. All synthetic listeners were confirmed stopped; no user-board listener was touched.

## Intervening executed attempts retained

These results preserve the failed and interrupted history that preceded the final pass. None independently substitutes for the final full gate.

| Revision | Smoke / types / unit / server / build / standalone access | Full browser outcome |
| --- | --- | --- |
| `8320dd1` | 2/2, 25.4s; both types; 102, 1.17s; 110, 7.02s; 8.12s; 121/121, 4.0m | Not started; held for confirmed narrow CSS corrections |
| `f2769dc` | 2/2, 24.2s; both types; 102, 1.07s; 110, 7.25s; 7.97s; 121/121, 4.0m | 1507 selected; 1069 passed, 53 failed, 1 interrupted, 384 unrun, 52.7m |
| `2d4a7aa` | 2/2, 28.9s; both types; 105, 1.20s; 112, 7.39s; 8.28s; 123/123, 4.3m | 1533 selected; 58 passed, 0 failed, 1 interrupted, 1474 unrun, 1.9m; held for proven local-copy invoker focus defect |
| `6d6dade` | 2/2, 28.7s; both types; 105, 1.29s; 112, 7.44s; 8.94s; 123/123, 4.4m | **All 1533 executed**: 1525 passed, 8 failed, 0 skipped/interrupted/unrun, 54.9m |
| `7341672`, first attempt | 2/2, 26.6s; both types; 105, 1.28s; 112, 7.43s; 8.78s; 123/123, 4.3m | Host-interrupted outcome and exact project counts above |

At `f2769dc`, per-project passed/failed/interrupted/unrun counts were dev **345/6/0/0** (351), prod **340/5/0/0** (345), Firefox **333/12/0/0** (345), WebKit **51/30/1/263** (345), access **0/0/0/121** (121). At `2d4a7aa`, dev was **58/0/1/298**; prod, Firefox and WebKit each had 351 unrun, and access had 123 unrun. At `6d6dade`, dev was **356 passed / 1 failed**, prod **351/0**, Firefox **351/0**, WebKit **344/7**, access **123/0**. Every `6d6dade` failure was retained: one native singleton readiness assertion and seven WebKit pre-navigation/persistence request-lifetime failures. The final guarded run executed their unchanged semantic assertions successfully.

The intervening production/UI/native recovery fixes and independent review decisions are documented in the review, UI-fix, security and regression records. This checkpoint records execution scope rather than replacing those audits.

## Earlier continuation through `995ec47`

The seven-command gate ran sequentially on synthetic services. Implementation remained at `033ecc0`; fixture correction `1a55d14` preceded the second run. Both runs reached the full browser command. Selection is **1462 tests in 44 files**: dev 342, production Chromium 336, Firefox 336, WebKit 336, access 112. Unexecuted cases are recorded explicitly below; selection is not execution evidence.

| Scope | At `033ecc0` | At fixture revision `1a55d14` |
| --- | --- | --- |
| Both typechecks | Passed | Passed |
| Exact production two-case smoke | 2 passed, 25.6s | 2 passed, 24.1s |
| Unit suite | 102 passed, 11 files, 1.08s | 102 passed, 11 files, 1.04s |
| Server suite | 110 passed, 7 files, 6.51s | 110 passed, 7 files, 6.75s |
| Production build | Passed, 8.24s | Passed, 8.66s |
| Access project | 112 passed, 3.8m | 112 passed, 3.8m |
| Full 1462-case matrix | Interrupted after 50 completed dev cases: 24 passed, 26 failed; 1412 unrun | Interrupted after 75 completed dev cases: 31 passed, 44 failed; 1387 unrun |

Neither interrupted matrix is a passing gate. Runtime output and error contexts were retained outside public history. All completed access/smoke runs had zero skips; no required case was excluded from the configured full matrix. Existing build warnings remain.

### Proven fixture corrections

- `1a55d14`: the isolated final-acceptance HTTP proxy omitted Vite's HMR upgrade. Dev collectors reported WebSocket handshake HTTP 200. The fixture now forwards the real upgrade and cleans up sockets; collectors remain active. A separate injected image-revocation case caught the native image component's handled `Account source is stale` cancellation. The test checks no such error before injection, bounds any occurrence to the revoked phase, rejects unhandled page errors and retains zero protected editor/blob/title oracles. Focused dev evidence: initial 15 passed / 1 cancellation-expectation failure in 40.6s, then 16 passed in 41.0s.
- `995ec47`: six older suites had independent HTTP-only proxies with the same HMR defect. All now share `proxyApplicationAssets` and explicit socket cleanup. The empty-library case uses a fresh synthetic repository because the preceding dev-only account-workspace conformance suite grants the Viewer a board. Its empty state, create/reopen, denied-target and unchanged-authoritative-library assertions remain intact.
- The 108-case affected dev run passed 107 and failed one recovery readiness assertion in 3.4m. Native root mounting briefly exposed two roots during opening; an exact singleton wait now precedes visibility after both authentication and reload. The first four-case retry passed three and found the same transition at the later reload (25.1s); the final adjacent recovery rerun passed all four in 24.3s, retaining exact native model and image hash/bytes. This is focused recovery evidence, not a new 108-case or full-matrix pass.

Both typechecks passed again before `995ec47`. No production, project-selection, schema or dependency file changed in these fixture commits; no oracle was removed. The shared-proxy mechanism uses the Node.js [HTTP upgrade contract](https://nodejs.org/api/http.html#event-upgrade) (raw upgraded socket handling). The handled cancellation trace was confirmed in the installed native image component's `refreshData(...).catch(console.error)` path.

Current synthetic 490px and 1404px recovery/library/sharing screenshots are retained in ignored `.gsd/acceptance-03-12/current-dev/`. The implementation is unchanged since those captures; forthcoming UI changes require refreshed screenshots. All synthetic listeners were stopped before the exclusive slot was released. Task 03-12-01 remains incomplete; finish the UI remediation and then execute the exact smoke and entire seven-command gate from the new revision. Actual-provider and native evidence gaps below remain unchanged.

## Earlier continuation at `12a2184`

All results in this section were executed at implementation/test revision `12a2184` using fresh synthetic services. No source or test files changed in this continuation. The operator checklist now documents editable ZIP restoration through the authenticated private-copy flow.

| Command / scope | Result |
| --- | --- |
| `npm run typecheck` | Passed for exact smoke and blocking chain. |
| Exact two-file production `@03-12-smoke` command from the plan | 2 passed, 25.5s, zero failures/skips. |
| `npm run typecheck:server` | Passed. |
| `npm test` | 102 passed, 11 files, 1.12s. |
| `npm run test:server` | 110 passed, 7 files, 6.64s. |
| `npm run build` | Passed, 3899 modules, 8.04s; existing mixed-import/chunk-size warnings retained. |
| `npm run test:access` | 110 passed, 3.7m, zero failures/skips. |
| `npm run test:browser` | Not started: held by orchestrator for the Viewer Import menu correction. Refreshed selection is 1452 cases in 44 files: dev 340, production Chromium 334, Firefox 334, WebKit 334, access 110. Selection is not execution evidence. |

The exact seven-command gate was started sequentially. Only its outer shell was paused while the access child finished, then terminated after the passing result to prevent automatic browser-matrix startup. This launcher termination does not change the access result and does not establish a completed final gate. All synthetic listeners were confirmed stopped before releasing the slot. Current 490px and 1404px recovery/library/sharing screenshots are retained in ignored `.gsd/acceptance-03-12/current-access/`. Earlier evidence below retains its original revision/count scope.

## Changes and observed regressions

- `b147c1b` adds signed operation-receipt denial evidence. The initial test expected 404 after revocation and received 200. The test ran and failed for that assertion.
- `014ba75` adds measured interface acceptance. A sharing Close control measured 26.53125px wide at the narrow viewport. A subsequent check measured 2.904:1 text contrast.
- `83f1253` reauthorizes receipt disclosure against current resources, rejects wrong-kind import IDs, and fixes the sharing Close control using a 44px minimum, no flex shrink and the existing board-ink color. Completed actor-owned delete acknowledgment and completed private-copy reconciliation remain available; revoked source content remains inaccessible. Focused server coverage passed 23 tests in 2.10s. Six production acceptance cases passed in 30.854s with zero skips.
- `766918b` aligns two integration assertions with the authorized native editor and account-change boundary, and adds the generic operator checklist. Initial access execution passed 98 cases and failed these two stale assertions in 4.0m. The first expected an obsolete board heading; the second expected an export dialog after the entire protected editor had correctly been removed. Preview denial, image failure, delayed response and zero-download assertions remain.
- `f7be2f8` completes the preview fixture and strengthens the foreign-board oracle. The first fixture rerun passed 99 cases and failed the preview open in 3.7m: its old library-only seed had no document rows. Creating this case's board through the authorized API restored the full native fixture; its focused rerun passed 1 case in 18.5s. The final canary matrix additionally checks both board canaries in every denied response and rereads a foreign target through that board's independent owner.
- `1d3c9cb` addresses the refresh timing race. The next access run passed 99 cases and exposed this race in the exact library ordering assertion in 3.4m. The approved test correction waits for the same exact ordered ID array after refresh; count, ordering and foreign-canary requirements remain unchanged.

The narrowly approved implementation changes are limited to current receipt authorization/import kind validation and the measured sharing Close accessibility defects. No new endpoint or schema is introduced.

## Executed gate evidence

| Command / scope | Result |
| --- | --- |
| `npm run typecheck` | Passed before final gate and after fixture corrections. |
| `npm run typecheck:server` | Passed. |
| `npm test` | 102 passed, 11 files, 1.05s. |
| `npm run test:server` | 109 passed, 7 files, 6.90s. |
| `npm run build` | Passed, 3899 modules, 7.96s; existing chunk/import warnings retained. |
| Exact `@03-12-smoke` selection in production | Final strengthened run: 2 passed, 25.3s, zero skips (earlier run: 23.5s). |
| `npm run test:access` initial run | 98 passed, 2 stale-assertion failures, 4.0m. |
| `npm run test:access` first fixture rerun | 99 passed, 1 incomplete-board-fixture failure, 3.7m. |
| Focused denied-preview case after complete API creation | 1 passed, 18.5s. |
| Access rerun with complete preview fixture | 99 passed, 1 refresh timing failure, 3.4m. |
| `npm run test:access` final fixture rerun | 100 passed, 3.4m, zero failures/skips. |
| `npm run test:browser` | Not started: paused by the orchestrator for review remediation. Selection inventory is 1402 cases: dev 330, production Chromium 324, Firefox 324, WebKit 324, access 100. Inventory is not execution evidence. |

## Current route inventory and observable oracles

The source was refreshed after receipt fixes: 30 method/route pairs across `server/auth/oidc.ts` and `server/boards/{routes,documents,blobs,grants,actions,imports}.ts`. Implicit framework HEAD routes are outside this application-method inventory.

| Method / route | Execution oracle |
| --- | --- |
| GET `/auth/start` | Signed-provider independent identities and protocol tests; transaction and return target. |
| GET `/auth/callback` | Signed code/state/nonce/PKCE/issuer/audience/lifetime and trusted identity tests. |
| GET `/api/session` | Current/minimal identity, expected-account mismatch, expiry and logout rejection. |
| POST `/api/logout` | CSRF denial, explicit destruction, pending-work preservation and deliberate sign-in. |
| GET `/api/boards` | Role-specific visibility, deterministic filters/order and no foreign canary. |
| POST `/api/boards` | Private descriptor, operation replay, expected-account/CSRF and unchanged existing board. |
| GET `/api/boards/:boardId` | Four identities, readable capabilities, absent/foreign/revoked IDs and unchanged owner reread. |
| PATCH `/api/boards/:boardId` | Current role, revision, replay, denied mutation and current receipt after downgrade. |
| DELETE `/api/boards/:boardId` | Owner capability, absent/foreign/CSRF denial, completed-delete replay acknowledgment. |
| GET `/api/operations/:operationId` | Actor isolation, missing/foreign operation, revocation, current role and completed delete. |
| POST `/api/boards/:boardId/docs/:docId/pull` | Bound document ID, reader canary bytes, foreign/missing document and expected-account denial. |
| POST `/api/boards/:boardId/docs/:docId/push` | Writer boundary, invalid/foreign binding, unchanged document/vector and commit-time revocation. |
| GET `/api/boards/:boardId/blobs` | Authorized keys only and no foreign board membership. |
| GET `/api/boards/:boardId/blobs/:key` | Exact authorized image bytes, foreign key binding, no denied image bytes. |
| PUT `/api/boards/:boardId/blobs/:key` | Writer/CSRF/current-account boundary with unchanged owner image hashes. |
| DELETE `/api/boards/:boardId/blobs/:key` | Writer boundary and referenced-image conflict with unchanged bytes. |
| GET `/api/boards/:boardId/thumbnail` | Exact thumbnail canary, no-store, denied/late generation and object-URL disposal. |
| PUT `/api/boards/:boardId/thumbnail` | Writer/current-account/CSRF boundary and unchanged owner thumbnail bytes. |
| GET `/api/members` | Board-owner search authority, established members, bounded ordering and no foreign disclosure. |
| GET `/api/boards/:boardId/grants` | Owner authority, current active/pending rows and no denied metadata. |
| POST `/api/boards/:boardId/grants` | Owner/CSRF boundary, Viewer default, pending activation and idempotence. |
| PATCH `/api/boards/:boardId/grants/:grantId` | Owner/row revision, role change acknowledgment and commit-time authorization. |
| DELETE `/api/boards/:boardId/grants/:grantId` | Owner/row revision, replay and effective immediate HTTP revocation. |
| GET `/api/boards/:boardId/editable-export` | Owner/Editor exact snapshot and manifest, Viewer/non-member/foreign denial. |
| POST `/api/boards/:boardId/duplicate` | Owner/Editor capability, source revision, staging, private destination and unchanged source. |
| POST `/api/imports` | Explicit selected local stage, expected account/CSRF and idempotent operation. |
| PUT `/api/imports/:operationId/document` | Actor/stage identity, root/content/image binding and unchanged SQL on denial. |
| PUT `/api/imports/:operationId/blobs/:key` | Actor/declared manifest, exact bytes and unchanged SQL on denial. |
| POST `/api/imports/:operationId/commit` | Complete publication, wrong-kind rejection, current session/source authority and completed private-copy reconciliation. |
| GET `/api/imports/:operationId` | Actor isolation, wrong-kind unknown status, revoked staging source and current destination authorization. |

The final role/resource smoke performs 189 denial attempts with separate Owner, Editor, Viewer and non-member signed cookie contexts, two distinct board/document/image/thumbnail canaries, and an authoritative owner reread after every denial. The reread compares document bytes/state vectors, image and thumbnail bytes, title/revision/metadata and grants. Transaction coverage additionally compares all nine board/import tables around rejected import requests. Focused receipt regressions preserve completed private-copy and deletion reconciliation.

## Requirement and decision evidence

| Requirement | Executable evidence |
| --- | --- |
| AUTH-01 | `server/auth/oidc.test.ts`, `tests/authentication.spec.ts`, `tests/session-recovery.spec.ts`; actual-provider acceptance pending. |
| BOARD-01 | `tests/board-access.spec.ts`, `tests/board-actions.spec.ts`, `tests/local-board-import.spec.ts`, `tests/account-workspace.spec.ts` (dev harness). |
| BOARD-02 | `tests/board-library.spec.ts`, `tests/board-sharing.spec.ts`; canary visibility matrix. |
| BOARD-03 | `server/boards/grants.test.ts`, `tests/board-sharing.spec.ts`; current grant receipt and revoked staging regression. |
| BOARD-04 | `tests/access-boundaries.spec.ts`, `tests/board-roles.spec.ts`, `server/boards/access.test.ts`, `server/boards/operation-receipts.test.ts`, grant/action tests and native regressions. |

Decision mapping follows the approved context and index, with execution evaluated by the final gate: D-01 authentication/deep entry; D-02 preservation/recovery; D-03 explicit Dali-only logout; D-04 persistent session until configured expiry; D-05 private creation; D-06 active/pending sharing and trusted first-sign-in activation; D-07 Viewer default; D-08 links confer no access; D-09 permitted presentation exports; D-10 Owner/Editor private duplication; D-11 Owner/Editor rename; D-12 owner-only grants/delete; D-13 authorized account board entry; D-14 library states/filtering/order; D-15 new-tab creation and editable title; D-16 explicit selected local copy with original preservation and account isolation. The prior plan summaries and final suite results establish execution; this mapping alone does not.

## Interface evidence and limits

The 39 approved predicates map to executable cases as follows. Final pass status awaits the complete matrix.

| Predicate group | Count | Executable file / cases |
| --- | ---: | --- |
| UI-AUTH loading/error/overflow/long-text | 4 | `authentication.spec.ts` loading and `session-recovery.spec.ts` long authentication error/recovery. |
| UI-HOME empty/loading/error/populated/partial/overflow/zero-one-many/long-text | 8 | `board-library.spec.ts` explicit UI-HOME cases, denied preview lifecycle; `accessibility-access.spec.ts` fifty long rows. |
| UI-TITLE empty/loading/error/partial/long-text | 5 | `board-actions.spec.ts` Unicode/blank bounds, delayed/failed/lost acknowledgments and focus. |
| UI-SHARE empty/loading/error/populated/partial/overflow/zero-one-many/long-text | 8 | `board-sharing.spec.ts` empty/partial/IME, stale searches, row isolation, failures and 0/1/50 rows; final measured targets/contrast. |
| UI-COPY empty/loading/error/populated/partial/overflow/zero-one-many/long-text | 8 | `local-board-import.spec.ts` inventory, selection, validation, failure/reconciliation, long lists and original preservation. |
| UI-CANVAS empty/loading/error/populated/overflow/long-text | 6 | `board-access.spec.ts`, `board-roles.spec.ts`, `board-actions.spec.ts`; protected mount, denied state and native read/write behavior. |

Synthetic screenshots at 490px and 1404px are retained in ignored `.gsd/acceptance-03-12/` for recovery, library and sharing. Measured enabled text samples: 158 per viewport, minimum contrast 17.3905887:1. Visible controls satisfy the asserted 44px target bounds, long library/sharing rows fit without page overflow, modal Tab/Shift+Tab focus remains contained, and focus returns after close/recovery. Constructed composition events establish event routing only.

Actual history navigation was executed with revocation before back navigation. Chromium performed an ordinary reload; no actual persisted BFCache restoration has been observed. Constructed persisted `pageshow` coverage is recorded separately in session recovery tests. Native 200% browser zoom, native OS IME and assistive-technology speech remain narrowly scoped observations because the available environment could not perform them. No CSS-scale or viewport substitute is counted as real zoom.

## Actual-provider checkpoint packet

Task 03-12-02 remains **not run / human_needed**. Its precondition requires an operator-registered confidential OIDC application, two assigned dedicated test members, a denied identity and trusted membership/verified-email mapping outside the public repository. The exact generic configuration names, provider administration steps and A1–A9 oracles are in [access-acceptance.md](../../../docs/access-acceptance.md) (operator configuration and acceptance procedure).

After independent review and private setup, the agent exercises the configured application and records generic accepted/failed-step status only. Operator values, real traces, actual identities and screenshots stay in the operator-controlled evidence store. A2 requires actual directory trust/uniqueness semantics; synthetic claims cannot satisfy it. Additional manual observations are limited to the native gaps listed above.

Descriptor-less prohibitions remain **flagged-unverified** where the workflow has no wired deterministic check. The public staged content was reviewed for organization neutrality and contains synthetic fixtures only. Final independent threat review records 31/31 closed threats; the four prohibition dispositions remain pending.

## Historical execution handoff and self-check

The browser/build slot was released after the current fixture corrections and focused dev recovery checks. Current automatic task completion is 0/1; plan completion remains 0/2 because the automated task still requires UI remediation and the complete matrix, followed by the actual-provider checkpoint. Overall tracking remains 2/13 phases and 25/26 plans complete.

All named implementation/test/checklist files and six task commits were verified present. No tracked files were deleted. Unrelated assets and milestone lock were preserved. Independent review findings take precedence over earlier passing focused tests; a passing subset cannot close the final acceptance task.

Continuation self-check: current implementation commit, both exact smoke cases, all 110 access case results and all six refreshed screenshots were verified present. No implementation/test mutation or required skip was introduced. Parent-owned review artifacts remain untouched.

Latest continuation self-check: `1a55d14` and `995ec47`, the exact smoke and 112-case access logs, both interrupted matrix logs, focused dev results and six current-dev screenshots were verified present. No tracked files were deleted. Parent-owned audit artifacts were preserved. The previously quoted 110-case self-check remains historical.

## Final verification handoff

The independent verifier reconciled all 1,533 browser events and inspected implementation, 104 roadmap/plan truths, 41 required artifacts and 28 links. Result: **human_needed, 99/104 verified**, zero established implementation blockers. Four truths retain unobserved native behavior and actual-provider acceptance remains uncertain. Three named behavioral unit probes and the 17-case provider self-test also passed independently. Code review has no open findings; security is 31/31 closed; UI is 24/24 for the unchanged application.

Current automatic task completion is **1/1**; plan task completion is **1/2**. Plan 03-12 and Phase 3 remain open. The historical handoff immediately above predates remediation and the complete passing gate. The current acceptance checklist is `03-UAT.md`: actual provider, native zoom, genuine BFCache, OS IME, assistive-technology speech, Firefox/WebKit native clipboard and four explicit prohibition dispositions. All ten are pending. Run `$gsd-verify-work 3` to record observations and resolve them.
