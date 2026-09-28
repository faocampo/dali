# Phase 04-17 regression diagnosis

Status: focused verification passed; complete regression pending.

The final focused run passed all 32 selected cases across development Chromium and production Chromium, Firefox, and WebKit (two repetitions each), with zero failures, skips, or retries. Both typechecks and all 236 client tests passed. The complete frozen-source gate is still required.

## Recovery focus

The first diagnostic WebKit run reproduced two focus failures in six repetitions. A subsequent instrumented three-case run passed its original assertion, but recorded a later native `EDITOR-HOST.focus()` from `RangeBinding._onStdSelectionChanged`, reached through `GfxSelectionManager.setCursor`. Thus the original assertion could finish before the offending cursor animation frame.

The stored recovery token had already been removed by the trusted pointer action. Focus still belonged to the synthetic external button when the editor mounted; the native cursor notification subsequently focused the editor. The application recovery-token restoration was not the source of that call.

The regression now moves the pointer across the mounted canvas and waits for a changed native cursor selection before checking external focus. It failed against the original application in WebKit. An initial broad dispatcher guard also prevented cursor updates, and the strengthened assertion rejected it. That superseded run was interrupted after three passes and one failure, with one interrupted case and 27 unrun cases; it is not acceptance evidence.

The narrowed correction in `src/canvas/blocksuite-editor.ts` wraps this editor instance's synchronous cursor notification. When another element has keyboard focus, native range synchronization sees an inactive dispatcher only for that notification; pointer dispatch and cursor updates remain available. The original dispatcher state is restored in `finally`, and editor disposal restores the original cursor method. This is the native mount owner expansion explicitly allowed by plan 04-17.

## Font timeout fixture

The earlier Firefox message, `executing a cancelled action`, originates in RxJS `AsyncAction.execute` when a closed scheduled action is executed. The fixture installed a simulated clock after native/editor timers were already running. Playwright documents that switching clock implementations between scheduling and cancellation is undefined behavior. The fixture now installs its clock before its first navigation, retaining the same timeout, retry, and exact connector geometry assertions.

Source: [Playwright clock documentation](https://github.com/microsoft/playwright/blob/main/docs/src/clock.md) (clock installation ordering and native timer replacement). The observed RxJS message is consistent with the invalid fixture lifecycle; no claim is made that a stack from the original full-run Firefox error was retained.

## Session-request error

The earlier WebKit session-request access-control page error has not yet been causally reproduced. Focused checks retain failure traces, and the shared strict page-error collector now retains stacks alongside messages. No allowlist, retry, skip, or weaker assertion was added. A passing focused run cannot by itself close the complete gate.

## Acceptance limits

The seven user-accepted judgments and existing native acceptance remain accepted. Actual-provider, spoken assistive-technology, and independent storage/capacity acceptance retain their approved backlog dispositions. Full regression must pass at a stable recorded revision and source digest before Phase 4 can close.
