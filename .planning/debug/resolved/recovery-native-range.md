---
status: resolved
trigger: "Phase 3 recovery resumes native mind-map editing with the entire topic selected instead of its saved caret or range."
created: 2026-09-16
updated: 2026-09-17T00:15:19Z
---

## Current Focus

hypothesis: Recovery's MutationObserver queues another animation-frame attempt during awaited editor rendering. Success disconnects the observer but leaves that queued attempt live; the second mount creates a second editor and restores the first matching editor, while the new editor's startup selects all.
bug_class: concurrency
test: Automated fix verification and manager source/test/journal review are complete.
expecting: Exact native selection survives authorized replay with one mounted editor and retained surrounding text.
next_action: Return the committed automated-resolution evidence to Phase 3 execution; broader operator/native acceptance remains open.

reasoning_checkpoint:
  hypothesis: Successful recovery leaves a queued observer callback live; it mounts a second editor whose native startup selection overwrites the first editor's correctly restored range.
  confirming_evidence:
    - Firefox traces for both caret and range show attempt 1 -> editor 1 -> correct restored range -> success -> queued callback -> attempt 2 -> editors 1 and 2.
    - Both exact assertions then settle at index 0, length 19; expected values are index 19, length 0 and index 7, length 5.
  falsification_test: Removing only terminal stop/cancel after a green run must reproduce an extra native mount or incorrect actual selection; a single editor still failing after the fix would refute this complete mechanism.
  fix_rationale: Terminal success prevents stale callbacks from reentering restoration; exact appended-instance capture ties all readiness waits and range mutation to the editor actually mounted by this attempt.
  blind_spots: Development Chromium and production Chromium/Firefox/WebKit have passed the focused native and adjacent scenarios. Actual provider deployment, native browser zoom, and native OS IME/assistive-technology workflows remain separate Phase 3 acceptance work; synthetic composition events establish only the tested pause guard.
  candidate_causes:
    - code: callback remains queued after successful async recovery and retrieves an earlier matching editor after remount.
    - environment: native engine selection timing could independently overwrite a single editor; controlled cross-engine runs will test it.
    - data: corrupt saved range or text length, contradicted by observed correct token and first restoration.
  and_gate: no — nonterminal successful recovery alone causes the duplicate attempt; no external data/config/environment condition is required in the reproduced sequence.

## Symptoms

expected: After same-account authorization recovery and replay, resume the same native topic with its exact previous caret or selected substring. Subsequent typing preserves other text.
actual: Firefox and WebKit capture caret {index:19,length:0} or selected substring {index:7,length:5}, but both settle at {index:0,length:19} after recovery.
errors: Exact pre-typing range assertions fail in tests/session-recovery.spec.ts; original append assertion also loses the topic text.
timeline: Found by the Phase 3 cross-browser regression gate; the recovery token initially preserved editing mode only.
reproduction: Focus the synthetic topic, assert the native caret or substring selection, expire the session, sign in with the same account, wait for acknowledged replay, then inspect the native range before typing.

## Evidence

- timestamp: 2026-09-17T00:15:19Z
  checked: Final account mutation guard, static validation, scoped diff/privacy review, and process/listener release.
  found: npm test -- src/canvas/account/mutation-guard.test.ts passed 5/5 (185ms Vitest, 0.89s wall), covering deferred viewer/paused/account/board writes and stale-generation captured calls. npm run typecheck passed (4.34s wall); npm run typecheck:server passed (1.19s wall). Scoped git diff --check passed. No diagnostic logging or host paths remain in the source/journal. All owned test ports and final-run worker/server processes are stopped, verified with elevated read-only process inspection after sandbox ps was unavailable.
  implication: No required automated check remains. Source/test diffs remain limited to the assigned recovery logic and native-topic block; unrelated assets are untouched, no index writes/commits/archives occurred, and the user development server was not used.
- timestamp: 2026-09-17T00:14:04Z
  checked: Reapplied lifecycle fix; final native/adjacent recovery slice across dev, prod, prod-firefox, and prod-webkit.
  found: 44/44 passed, Playwright 2.6m and measured wall 158.57s. The 11 scenarios per project include start/end caret, interior selection, different identity, persisted-pageshow revalidation, viewer/revoked access, revocation during replay commit, stale session/logout/account race, prior control focus, and replay failure/retry.
  implication: Reapply reconfirms the fix and adjacent behavior across development and production bundles. This final 44-case result includes the previously run nine production native cases and is not additive coverage.
  command: playwright test tests/session-recovery.spec.ts --project=dev --project=prod --project=prod-firefox --project=prod-webkit -g 'native topic focus returns|different identity receives|persisted pageshow pauses|viewer recovery retains|revoked recovery retains|role revocation at replay commit|late session response cannot override|same-board recovery announces|failed replay stays pending' --timeout=35000
- timestamp: 2026-09-17T00:10:53Z
  checked: Surgical removal of only terminal cleanup and exact-instance lookup; saved range capture and readiness waits retained. Command: playwright test tests/session-recovery.spec.ts --project=prod-firefox -g 'native topic focus returns.*at end' --timeout=35000.
  found: 1/1 failed (23.5s case, 42.43s measured wall including build). Both internal and actual native ranges became index 0, length 19, and DOM selected text was the whole synthetic topic instead of empty.
  implication: Reverting this fix restores the original user-visible failure under the stronger oracle. Reapply exactly those changes before final verification; no shared work was stashed or reset.
- timestamp: 2026-09-17T00:09:24Z
  checked: playwright test tests/session-recovery.spec.ts --project=prod --project=prod-firefox --project=prod-webkit -g 'native topic focus returns' --timeout=35000.
  found: 9/9 passed; Playwright 47.8s and measured wall 48.54s, including fresh production build. End caret, interior substring, and start caret preserve exact internal/native ranges, DOM-selected text, surrounding text after direct typing, and one editor mount in all three engines.
  implication: Native render readiness works once recovery is terminal; proceed to causal revert/reapply confirmation and adjacent authorization/replay/generation checks.
- timestamp: 2026-09-17T00:08:34Z
  checked: Applied bounded source/test correction.
  found: Success now sets stopped, disconnects the observer, and cancels its queued frame. Readiness and selection restoration target mountPoint.lastElementChild with native class and model-id checks. Existing restoring/current scope/write checks remain. Tests now inspect internal plus actual native ranges and DOM-selected substring, cover caret start/end and an interior substring, type directly without End, and count editor mounts across recovery.
  implication: The focused cross-engine run tests both user-visible preservation and the duplicated-mount mechanism. Temporary diagnostic logging is removed.
- timestamp: 2026-09-17T00:06:19Z
  checked: Instrumented original Firefox caret and selected-substring tests, with existing readiness waits and unchanged range assertions.
  found: 2/2 failed (23.5s caret, 23.6s range). For each, attempt 1 mounted editor 1, queued callbacks during rendering, restored the correct saved range, and succeeded with stopped=false. The queued callback then accepted attempt 2 and mounted editor 2 alongside editor 1. Final range was index 0, length 19.
  implication: Confirms callback reentry and competing editor identities as the overwrite mechanism. Command: playwright test tests/session-recovery.spec.ts --project=prod-firefox -g 'native topic focus returns' --timeout=35000.
- timestamp: 2026-09-17T00:04:28Z
  checked: Runtime/source grant and checkout state.
  found: Manager granted exclusive scoped source, test, build, and listener ownership; HEAD is ea7e1f2. Test ports have no listeners. Only the two assigned source/test files are modified; unrelated untracked assets remain untouched.
  implication: The next browser run can isolate native recovery without concurrent fixture or build work.
- Knowledge-base lookup: no local debug knowledge-base file or callable MemPalace tool is available. No project skills or agent skill mapping is configured. SBFL skipped because the provided browser reproduction has no per-test coverage; concurrency ordering is the investigation route.
- Static ordering evidence: restoreRecoveryFocus schedule always queues a requestAnimationFrame, including mutations while restoring is true. Completion disconnects its MutationObserver and removes storage tokens but neither cancels the queued frame nor marks the closure stopped. The pending callback closes over captured and does not reread storage.
- Native instance evidence: mountShapeTextEditor always appends a new EdgelessShapeTextEditor and returns no instance. Recovery then querySelector selects the first editor. A second mount therefore leaves recovery awaiting/restoring the earlier instance while the newest instance runs firstUpdated selectAll.
- Native range evidence: selectAll synchronously calls setInlineRange; RangeService synchronizes immediately when rendering is false. Inline waitForUpdate waits for v-line completion. No timer inside selectAll explains a later overwrite after full render readiness, making duplicated recovery attempts the stronger candidate.
- Concurrency checklist: no shared arithmetic update or lock deadlock; the order violation is a queued observer callback outliving successful async recovery. Candidate categories are code (nonterminal success and editor identity) and environment (engine-dependent selection synchronization); data corruption is contradicted by correct captured range and text length in both engines.
- The uncommitted src/auth/session.ts patch captures the correct range before pause and retains account/board guards.
- The uncommitted native-topic block in tests/session-recovery.spec.ts asserts both ranges before and after recovery.
- EdgelessShapeTextEditor.firstUpdated schedules updateComplete.then(() => inlineEditor.selectAll()).
- Waiting for editor/rich-text updateComplete and inline waitForUpdate, followed by setInlineRange and syncInlineRange, has not prevented a later select-all overwrite.
- Committed source head before this investigation: 9367c5c. See ../../phases/03-okta-and-board-access/03-REGRESSION-FIX.md for the completed corrections and measured mixed-run outcomes.

## Eliminated

- Engine-specific range loss as the primary cause: the traced failure starts with a second recovery attempt and second editor, after correct first restoration. Browser coverage remains a verification obligation.
- Incorrect initial End gesture: explicit assertions prove the intended caret and selected substring before pause.
- Failure to capture the range: trace values match both expected ranges before native remount.
- Arbitrary timer or repeated animation-frame workarounds: these are not an accepted readiness contract.

## Resolution

root_cause: Successful asynchronous focus recovery is nonterminal and leaves a queued observer animation frame active. That callback mounts a second native editor; first-match lookup restores the prior instance while the new instance selects all.
oracle_type: specified — preserve the actual saved caret or substring and surrounding text after typing.
fix: Retain native range capture/readiness restoration; terminalize successful recovery and cancel pending callbacks; target the exact appended native editor.
automated_resolution: verified — manager reviewed the exact scoped source/test diff, confirmed preserved authorization guards and stronger behavioral assertions, and archived the automated regression. Broader Phase 3 actual-environment acceptance remains open.
verification:
  target_test: { result: pass, evidence: "12 native cases in final 44-case run: start/end caret and selected substring across dev/prod/prod-firefox/prod-webkit" }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker dependency or configuration is present; no tooling installed. Surgical revert/reapply supplied separate causal evidence." }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, evidence: "Diff preserves recovery and authorization checks, adds exact range capture/restore and cancels only callbacks after successful completion; test assertions strengthened." }
  adjacent_tests: { result: pass, suites_run: ["tests/session-recovery.spec.ts: 32 adjacent cases within the final 44", "src/canvas/account/mutation-guard.test.ts: 5 generation/lifetime cases"], evidence: "Identity isolation; persisted pageshow; viewer/revoked access; replay commit revocation; stale session/logout/account race; prior control focus; failed replay/retry." }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, evidence: "Surgical revert failed 1/1 Firefox case with actual full-text selection; reapply passed all 44 final cases." }
  static_checks: { result: pass, checks: ["npm run typecheck", "npm run typecheck:server", "git diff --check"] }
  stability: { result: pass, evidence: "All nine production native cases passed twice, with the second pass after surgical revert/reapply; final run also passed development native coverage." }
  guardrail_verdict: accepted
files_changed: [src/auth/session.ts, tests/session-recovery.spec.ts]
code_commit: 2d4a7aa
cycles: 2 investigation passes (source lifecycle analysis and instrumented runtime proof), 1 fix cycle (cross-engine green, surgical revert, reapply and adjacent validation).

## Prevention

causal_branches:
  code: The original focus token retained editing mode without an exact range. Adding asynchronous native readiness made observer-scheduled retries outlive successful restoration. Success disconnected future observations but left a queued callback able to enter again; first-match editor lookup then targeted the old editor. Terminal state plus callback cancellation closes the lifetime, and exact-instance lookup binds readiness and selection to one mount.
  environment: Browser engines made the selection outcome visible, but the traced duplicate callback precedes the native overwrite. Passing development/production Chromium, Firefox, and WebKit after reapply eliminates an engine-specific workaround as the fix mechanism.
  data: The captured range and first restoration were correct for both end caret and selected substring. Start/end boundary neighbors and direct retained typing cover the valid-range edges without clamping to an arbitrary caret position.
  and_gate: no — the nonterminal recovery lifecycle explains the reproduced failure without an additional environment or data fault.
why_not_caught: The existing cross-browser recovery gate caught the destructive typing symptom. Its earlier append scenario pressed End and lacked exact pre/post native-selection and single-mount assertions, which left caret preservation and queued-callback ownership untested directly. Static checks cannot establish event ordering.
recurrence_guard: tests/session-recovery.spec.ts native-topic recovery scenarios assert actual native and internal ranges, DOM-selected substring, unchanged surrounding text after immediate typing, and exactly one mounted native editor. They cover index zero, text-length caret, and an interior selection under an explicit replay acknowledgment barrier.
scope: Automated native-editor recovery regression only. Actual identity-provider deployment, native browser zoom, native OS IME, and assistive-technology acceptance remain with the Phase 3 final checkpoint. No duplicate human demonstration is requested for the proved automated regression.

## Specialist Review

specialist_hint: typescript
review: unavailable — no matching installed typescript-expert skill was found. Native instance/order evidence and focused browser regressions validated the scoped lifecycle correction.
