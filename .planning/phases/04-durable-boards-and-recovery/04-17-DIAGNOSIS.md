# Phase 04-17 regression diagnosis

Status: initial focused verification passed; subsequent complete regression failed; lifecycle correction passed focused verification; complete gate pending.

The final focused run passed all 32 selected cases across development Chromium and production Chromium, Firefox, and WebKit (two repetitions each), with zero failures, skips, or retries. Both typechecks and all 236 client tests passed. The complete frozen-source gate is still required.

## Recovery focus

The first diagnostic WebKit run reproduced two focus failures in six repetitions. A subsequent instrumented three-case run passed its original assertion, but recorded a later native `EDITOR-HOST.focus()` from `RangeBinding._onStdSelectionChanged`, reached through `GfxSelectionManager.setCursor`. Thus the original assertion could finish before the offending cursor animation frame.

The stored recovery token had already been removed by the trusted pointer action. Focus still belonged to the synthetic external button when the editor mounted; the native cursor notification subsequently focused the editor. The application recovery-token restoration was not the source of that call.

The regression now moves the pointer across the mounted canvas and waits for a changed native cursor selection before checking external focus. It failed against the original application in WebKit. An initial broad dispatcher guard also prevented cursor updates, and the strengthened assertion rejected it. That superseded run was interrupted after three passes and one failure, with one interrupted case and 27 unrun cases; it is not acceptance evidence.

The narrowed correction in `src/canvas/blocksuite-editor.ts` wraps this editor instance's synchronous cursor notification. When another element has keyboard focus, native range synchronization sees an inactive dispatcher only for that notification; pointer dispatch and cursor updates remain available. The original dispatcher state is restored in `finally`, and editor disposal restores the original cursor method. This is the native mount owner expansion explicitly allowed by plan 04-17.

## Font timeout fixture

The earlier Firefox message, `executing a cancelled action`, originates in RxJS `AsyncAction.execute` when a closed scheduled action is executed. The fixture installed a simulated clock after native/editor timers were already running. Playwright documents that switching clock implementations between scheduling and cancellation is undefined behavior. The fixture now installs its clock before its first navigation, retaining the same timeout, retry, and exact connector geometry assertions.

Source: [Playwright clock documentation](https://github.com/microsoft/playwright/blob/main/docs/src/clock.md) (clock installation ordering and native timer replacement). The observed RxJS message is consistent with the invalid fixture lifecycle; no claim is made that a stack from the original full-run Firefox error was retained.

## Reload request errors

The subsequent full run at `6296526ade32881cf407e39d369812d50537d909` selected 2,036 cases and was stopped after two WebKit failures: **1,604 passed, two failed, one interrupted, 429 unrun**. The classical-shape reload reported an access-control page error for a recovery session read; the connector-label reload reported the same class of error for a document push. Stacks identify the guarded fetch wrapper and the recovery authorization/replay paths. Assertions had passed; the strict unexpected-error collector rejected both cases.

Account-backed runtime lacked a page-hide suspension handler. A fail-first test holds an actual recovery request, dispatches pagehide, and verifies its AbortSignal, read-only state, retained journal, and eventual acknowledged content after reload/restoration. It failed on the original application because the signal remained active. Earlier draft fixtures incorrectly required simultaneous session and push requests; they were corrected to isolate each request kind and are not application-failure evidence.

The correction suspends the active scope synchronously on pagehide, aborting its document and recovery requests, then preserves pending work. Persisted pageshow retains the existing fresh-authorization requirement before editing resumes. Listener cleanup is symmetric; a late preservation failure cannot overwrite a newer session transition. This expands plan scope to the proven account-session lifecycle owner and a dedicated regression file.

All four initial production WebKit checks passed (session/push crossed with reload/synthetic persisted restoration). The missing cancellation is causally demonstrated; attributing every earlier native WebKit access-control message exclusively to that missing handler remains an inference. Repeated original-case coverage and the strict complete gate remain required. No allowlist, retry, skip, or weaker assertion was added. Synthetic page-transition events supplement the previously accepted native BFCache check; they do not replace it.

## Acceptance limits

The seven user-accepted judgments and existing native acceptance remain accepted. Actual-provider, spoken assistive-technology, and independent storage/capacity acceptance retain their approved backlog dispositions. Full regression must pass at a stable recorded revision and source digest before Phase 4 can close.

## Lifecycle correction validation

The repeated cross-engine run passed **88/88** cases, zero skips/retries, in 8.4 minutes. It includes all 32 mandatory focused cases, 32 pagehide cancellation/recovery cases, 16 original reload-error cases and eight persisted-pageshow authorization cases. Both typechecks and 236/236 client tests passed. No unexpected errors occurred. The complete stable-source gate is still required.
