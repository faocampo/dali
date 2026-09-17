# Phase 3 cross-browser regression corrections

Status: identified application corrections complete at `6d6dade`, fixture corrections complete at `73416723411ca2c5b98de090f6d5327ed9e076c7`, and the fresh complete automated gate passed at that revision. Baseline source `f2769dc`; correction pass starts after test-only Nyquist commit `e4c6b5c`. All checks run in the main checkout with the established sequential isolation decision. The sections below retain failed, mixed and interrupted attempts in chronological order; the final outcome supersedes their historical pending language. Actual-provider/native acceptance remains pending.

## Narrow application menu

Commit `5f5d99c`: `src/index.css`, `tests/canvas-view.spec.ts`.

The 390px popup painted below the later account controls. A local popup stacking level preserves the wrapping header while making Grid reachable. Tests retain viewport bounds, add the actual center hit target and selected Lines state, and cover Escape navigation.

- Fresh RED: production Chromium, original 390px case, failed at ordinary Grid click (15-second test bound).
- GREEN: `playwright test tests/canvas-view.spec.ts --project=prod --project=prod-firefox -g 'View menu and Grid submenu|Escape returns through View'`: 6/6 passed, 29.3s.
- Both TypeScript checks passed; scoped diff and whitespace review passed.

## Mind-map controls — investigation history

Fresh original 390px 1x/2x reproduction: both failed. Pointer evidence at 1x showed Close move from y168 to y220 between pointerdown and focus, while unchanged Font size blur performed a native write. At 2x, scrolling the whole inspector displaced its header outside the visible panel.

The first expanded correction attempt had 1 pass, 2 failures, 1 interruption and 8 unrun cases (2.1m). It exposed selected-topic occlusion from an excessively tall inspector and an added test reopening Properties after clearing selection. Neither failure was accepted as success.

A bounded inspector height and separate unchanged/changed-value scenarios then produced 3 passes and 2 failures (24.1s). Both remaining failures were 2x center hit-target assertions. A dedicated 2x diagnostic failed before clicking: the application header occupied 726 physical pixels of an 844px viewport, leaving a 70px visible inspector; Close was clipped above it. Two-column narrow header allocation restored actual space and the dedicated 2x case passed (17.8s). CSS magnification remains supplemental evidence, distinct from native browser zoom.

## Image journal — investigation history

The original WebKit Owner archive case failed before export. The actual IndexedDB journal Blob write reported `UnknownError: Error preparing Blob/File data to be stored in object store`; the preservation retry produced the same error. Source/session policy was unchanged during reproduction.

The correction copies new Blob records to bytes plus MIME before opening the write transaction. Failed conversion/storage retains the original in-memory record for explicit retry. Replay accepts existing Blob records and new byte records; acknowledgment still precedes record deletion.

Focused unit checks for journal retention/legacy replay and blob-source behavior: 12/12 passed, 184ms. Commit `a05cc24` changes `src/canvas/account/outbox.ts`, adds `src/canvas/account/outbox.test.ts`, and adds actual stored bytes/MIME plus replay MIME assertions in `tests/session-recovery.spec.ts`. The five WebKit archive/recovery scenarios below passed.

## Subsequent focused evidence

- Mind-map/header/menu final slice: `playwright test tests/mindmap-accessibility.spec.ts tests/canvas-view.spec.ts --project=prod --project=prod-firefox -g 'responsive focus targets|committed topic stays clear|View menu and Grid submenu'`: 24/24 passed, 1.1m. Both types passed. Commit `365d33a` changes `src/index.css`, `src/canvas/MindMapInspector.tsx`, and `tests/mindmap-accessibility.spec.ts`.
- Mixed WebKit diagnostic slice (archive, quota recovery, UI/focus, deep link): 5 passed / 5 failed, 1.8m. Both Owner/Editor complete archive round trips, byte/MIME image replay, quota retry and logout quota retry passed. The failures remained native select geometry, three focus cases, and a session request diagnostic. These are separate outcomes, not a consolidated pass.
- Focus/network/caret trace slice: 2 passed / 4 failed, 45.9s. Scoped route-heading focus passed Firefox's complete measured UI case. Both Firefox/WebKit native recovery initially selected all 19 characters; End retained that selection.
- First caret implementation attempt prevented browser startup on a nullable inline-editor TypeScript error; no browser cases ran. The guard was corrected.
- Controls/recovery second attempt: 8 passed / 6 failed, 2.5m. Delete and Share trigger restoration and filter/refresh focus passed in Firefox and WebKit. WebKit's explicit native select height passed geometry; its measured case then exposed destructive-button background contrast. Native caret/range and the WebKit session diagnostic remained failures.
- Native capture trace: both cases failed; captured caret `{index:19,length:0}` and intentional range `{index:7,length:5}` were correct, while post-mount ranges were both `{index:0,length:19}`. This distinguishes recovery synchronization from keyboard End semantics.
- Additional inline-render/controls attempt: 1 passed / 5 failed, 2.1m. Waiting for render alone did not prevent native selection overwrite. Destructive-button background remained the measured WebKit failure.
- Relevant server authorization/blob checks: `npm run test:server -- server/boards/access.test.ts`: 18/18 passed, 3.11s. Both static checks passed before this run.

## Fixture diagnostics reserved for acceptance

No broad console allowances or fixture compatibility changes are applied here. The known link-role, singleton-root, original URL and clipboard fixture corrections remain with acceptance. The preview lifecycle test deliberately fetches an already-revoked Blob URL and expects rejection; its engine-specific console representation needs phase-scoped inspection. The session-network diagnostic is investigated independently of the proved Blob storage failure.

## Final bounded pass and committed UI roots

- Commit `4081cd2`: `src/boards/BoardLibrary.tsx`, `src/header/Header.tsx`. Explicitly focus mouse-invoked dialog triggers before opening and filter/refresh controls before changing state. Existing Delete/Share return-focus and filter assertions passed in both Firefox and WebKit in the 8/14 mixed pass above.
- Commit `9367c5c`: `src/index.css`, `tests/accessibility-access.spec.ts`. Programmatically focused route headings receive the scoped accent outline, native sharing selects have explicit 44px height, and neutral/destructive sharing buttons use the approved surface with appropriate ink. Measured assertions now include pre-keyboard heading focus, actual select height, and diagnostic foreground/background contrast evidence.
- Final command: `PLAYWRIGHT_BROWSERS_PATH=/tmp/dali-playwright npx playwright test tests/session-recovery.spec.ts tests/accessibility-access.spec.ts tests/board-access.spec.ts --project=prod-firefox --project=prod-webkit -g 'native topic focus returns|rendered contrast|authorized deep link mounts' --timeout=35000`: **3 passed / 5 failed, 2.3m**. Both complete measured UI cases and Firefox deep link passed. Four native range cases and WebKit deep link collector failed. These results overlap previous slices and are not additive coverage claims.
- `npm run typecheck` and `npm run typecheck:server` passed again before the three final commits. Scoped staged diffs and whitespace checks passed. All commits use neutral contributor attribution.

## Historical native-range handoff at 9367c5c

Only `src/auth/session.ts` and the final native-topic test block in `tests/session-recovery.spec.ts` remain modified. The journal hunks in that test file are already committed separately. Temporary network instrumentation in `tests/board-access.spec.ts` was removed. This report remains uncommitted.

The source patch captures native UTF-16 inline range before suspension and persists it with the existing account/board focus token. On recovery it waits for editor `updateComplete`, rich-text `updateComplete`, and inline `waitForUpdate()`, then uses `setInlineRange` and `syncInlineRange` under existing account/board/runtime guards. **Restoration remains failing and must not be treated as verified.** Keep the useful capture patch for the debugger.

Tests assert the pre-pause caret `{index:19,length:0}` and intentional selected range `{index:7,length:5}`, replay acknowledgment barrier, post-recovery range and selection, and final unchanged-prefix text. Both engines instead restore `{index:0,length:19}`. The trace showed correct captured token and immediate setter result, followed by whole-text selection. Native `EdgelessShapeTextEditor.firstUpdated()` registers an `updateComplete.then` callback that calls `selectAll()` for mind-map shapes. Its `getUpdateComplete()` also waits for rich-text updates; inline render completion can queue selection synchronization. Exact later overwrite ordering remains unresolved. No arbitrary timeout or global focus-end workaround was added.

## Historical request diagnostic at 9367c5c

WebKit root sign-in request first returns 401, OIDC returns to the root, and a new root `/api/session` fetch fails with the engine's access-control pageerror. The next board navigation occurs 7ms after the error; its session request and thumbnail both return 200 and the content/cold-open assertions pass. The failing root request has no observed HTTP request/response event. The wrapper caught `TypeError: Load failed`; no unhandled-rejection event was observed. A temporary pagehide-abort probe did not remove the error and was discarded. This timing suggests navigation interaction but does not conclusively establish cancellation; no production network patch or collector allowance was added.

All owned synthetic listeners were stopped by Playwright teardown; ports 5493, 5494, 5497 and 5499 had no listeners at handoff. Source/test/index/build/runtime slots released to the parent.

## Verified closure of the handoff

- **Fixture diagnostics — `ea7e1f2`.** Exact board link roles and IDs resolve identical titles; reload waits for the singleton native root and retains the original authorized URL. Chromium uses actual clipboard permission/keyboard transport; Firefox/WebKit exercise native handlers through DataTransfer with the OS-integration limit explicit. Error collection retains raw console diagnostics plus actual Error name/message. Narrow injected-cancellation, revoked-URL and SVG-parser allowances retain request, current-board and canary oracles. The WebKit deep-link diagnostic was a fixture navigating before authenticated-library mount; waiting for that real readiness boundary resolves it without application network changes. Initial diagnostics: 49/56 passed, 7 failed; final unchanged slice: **56/56 passed across four variants, 2.4m**. Final Firefox parser cases: **2/2, 29.7s**. Both type checks passed.
- **Native range recovery — `2d4a7aa`; debug journal `b5698b2`.** Runtime traces proved a queued observer/frame callback mounted a second native editor after successful restoration; its initialization selected the entire label. Recovery now binds to the exact appended editor and makes success terminal by stopping observers and queued frames. Account, board, generation, read-only and connectivity checks remain. An isolated removal of the terminal/instance correction reproduced failure in the original case. Final **44/44 passed across four variants, 2.6m**, including 12 native start/end/interior-selection cases and 32 identity/access/replay/control-focus cases. Assertions cover exact range, selected text, typing without an End workaround and one editor. Generation unit checks: **5/5, 185ms**; both type checks passed. See `../../debug/resolved/recovery-native-range.md` for the causal trace and evidence limits.
- **Local-copy dialog return focus — `6d6dade`.** Independent UI review found that WebKit's mouse click did not focus the Copy local boards invoker. Both original cases reproduced RED (**2/2 failed, 69.2s**) after successful copy/original-preservation assertions. One explicit `event.currentTarget.focus()` before opening fixes the actual invoker. Both unchanged cases across four variants passed **8/8, 49.8s** after a fresh build; both type checks passed. UI-X5 is closed.
- **OIDC key-rotation coverage — `e4c6b5c`.** NYQ-01 now uses real signatures, an unpublished key ID with no session/member mutation and denied replay, plus key refresh in the same application/issuer with an observed second JWKS fetch after the library cooldown. OIDC **60/60, 7.28s**; compiled provider self-test **17/17, 158ms**; full server **112/112, 7.30s**; both type checks passed. The initial sandbox listener denial was environmental; it is not claimed as a behavioral RED.

## Complete-gate history and remaining acceptance

At `f2769dc`, the 1,507-case matrix stopped after **1,069 passed, 53 failed, 1 interrupted and 384 unrun**; its failures drove the corrections above. At `2d4a7aa` (documentation HEAD `b5698b2`), smoke **2/2**, unit **105/105**, server **112/112**, build and standalone access **123/123** passed. Its 1,533-case matrix was intentionally stopped for the independently found local-copy focus defect: **58 passed, zero failed, 1 interrupted, 1,474 unrun**. Neither interrupted run establishes a complete gate pass.

The complete gate ran at `6d6dade` with a 1,533-case inventory: dev 357; production Chromium 351; Firefox 351; WebKit 351; access 123. Code review reports no open findings, UI review 24/24, and all 31 declared security threats remain closed. The executor checkpoint owns final whole-suite outcomes and timings.

Actual-provider A1–A9, native 200% zoom, OS IME, assistive-technology speech and genuine persisted BFCache restoration remain pending. The latest history observation was ordinary reload. No local-copy original, real user board or operator configuration was changed for this validation.

### Full run at 6d6dade

The full matrix completed in **54.9m: 1,525 passed, 8 failed, zero skipped/interrupted/unrun**. Development: 356/357; production Chromium: 351/351; Firefox: 351/351; WebKit: 344/351; access: 123/123. Native range recovery and local-copy return-focus corrections passed across the browser variants.

One development sticky-note reload sees two transient native roots before its persistence oracle. Six WebKit failures concern library thumbnail requests during navigation, and one concerns a document push during fill-opacity reload. Strict request/runtime collection remains active. The following correction pass must establish the real navigation/acknowledgment cause and complete a fresh whole gate. These failures do not reopen a previously closed source finding without causal evidence.

### Fixture-readiness correction — 7341672

A controlled WebKit setup with 24 real synthetic thumbnails reproduced the immediate-heading/programmatic-navigation failure. The trace showed requests starting as navigation was announced, then failing before pagehide with no observed abort. Both ordinary user card-link navigation and programmatic navigation after the authorized previews rendered passed the unchanged strict collector: **2/2 in 23.6s**. This established the fixture's incomplete readiness boundary; production code was unchanged.

Commit `73416723411ca2c5b98de090f6d5327ed9e076c7` changes six test files: `tests/fixtures.ts`, `tests/authentication.spec.ts`, `tests/board-access.spec.ts`, `tests/canvas-feedback.spec.ts`, `tests/community.spec.ts`, and `tests/session-recovery.spec.ts`. The library helper obtains the real authenticated catalog with expected-account header and waits for the exact authorized card/preview counts before fixture setup leaves the page. Three reload paths require exactly one native root before their original assertions. The opacity persistence case waits for Saved before reload. Existing role, content, image, acknowledgment, denial and error assertions remain; no diagnostic allowance was added.

The focused verification selected 12 affected behavioral cases plus one 24-thumbnail seeding prelude in each of four browser variants: **52/52 passed in 2.2m**, with no skipped or failed cases. A temporary unused diagnostic variable initially caused compilation to stop before any browser case; it was removed and both type checks passed before the successful run and again before commit. Both temporary diagnostic/seed specs were removed before commit. The restored complete inventory remains **1,533 cases across 44 files and five projects**.

Independent code review reports zero blockers/warnings across the new six-file delta and **98 distinct cumulative paths**. Security retains all 31 closures. The application remains at `6d6dade`; the fresh complete gate is running against source and fixtures `7341672`. The earlier failed matrix retains its exact outcome above.

### Host-suspended run at 7341672

The initial checks passed at `7341672`: exact smoke **2/2, 26.6s**, both type checks, unit **105/105, 1.28s**, server **112/112, 7.43s**, build **8.78s**, and standalone access **123/123, 4.3m**. The subsequent full browser run was disrupted by repeated host sleep intervals and stopped with **810 passed, 40 non-passes (36 timed out, four failed), one interrupted and 682 unrun**, over 9.9 hours of elapsed wall time.

| Project | Passed | Timed out | Failed | Interrupted | Unrun |
|---|---:|---:|---:|---:|---:|
| dev | 357 | 0 | 0 | 0 | 0 |
| prod | 326 | 24 | 1 | 0 | 0 |
| prod-firefox | 127 | 12 | 3 | 1 | 208 |
| prod-webkit | 0 | 0 | 0 | 0 | 351 |
| access | 0 | 0 | 0 | 0 | 123 |

The executor initially inferred progress from recent passing log lines and incorrectly reported production as entirely passing. Those interim claims are withdrawn; the table is reconciled against the complete event record. All future progress totals use every recorded case status.

The first affected 120-second case recorded 926.710 seconds and stalled in sign-in. A contemporaneous host suspension lasted 926 seconds, followed by repeated intervals of the same duration. This establishes environmental interruption; it does not independently prove each failed behavior correct. Raw host diagnostics remain outside the repository. The unchanged affected cases will be rerun with populated synthetic previews and an idle-sleep guard limited to the test command's lifetime, followed by a fresh full gate. No global power policy, application behavior, assertion or timeout is changed.

The subsequent guarded reproduction selected the exact **40 failed/timed-out project-qualified cases plus two populated-library preludes**. All **42/42 passed in 2.4m**, with the original assertions and timeouts. The guard was verified as an idle-system-sleep assertion owned by the test command; it and the test listeners released automatically on successful exit. Temporary seeding was removed, tracked source/tests remained unchanged, and the fresh complete gate uses the same process-scoped guard. This closes the focused reproduction requirement; full-matrix acceptance remains separate.

## Final complete automated gate — 7341672

The unchanged guarded candidate passed the full gate on 2026-09-17: exact smoke **2/2 (27.4s)**, both type checks, unit **105/105 (1.28s)**, server **112/112 (7.68s)**, production build **8.67s**, standalone access **123/123 (4.3m)**, and complete browser matrix **1,533/1,533 (57.1m)**. Projects: development357; production Chromium351; Firefox351; WebKit351; access123. There were **zero failures, timeouts, skips, interruptions or unrun cases**. Counts were reconciled against every event and the completed passing result; overlapping focused/access runs are reported separately.

All eight `6d6dade` failure cases passed in the complete shared-state order. All host-interrupted cases passed in both their exact focused reproduction and the full gate. The process-scoped sleep guard and synthetic listeners released automatically; no global power setting changed. Application/test source remained frozen throughout.

Code review has zero open findings across 98 cumulative paths; UI review is 24/24 for the unchanged application; security retains 31/31 closures. Five final actual-history annotations observed ordinary reload, so genuine BFCache restoration remains unobserved. Actual-provider A1–A9, native 200% zoom, OS IME, assistive-technology speech and flagged prohibitions remain separate checkpoint items. These automated results do not mark Phase 3 complete.
