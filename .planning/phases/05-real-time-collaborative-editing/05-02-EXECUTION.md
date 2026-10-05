# Plan 05-02 execution checkpoint

Status: execution resumed on 2026-10-05; outstanding typography failure tracked in GitHub issue #1. This is a working checkpoint, not a completed plan summary. Plan 05-01 is committed and verified. Plans 05-03 through 05-09 have not started.

## Implemented and observed

- Whole-object native text sessions retain reservations until editing ends; a second editor receives the authenticated holder's display name. Independent objects remain editable.
- Keyboard deletion acquires the derived affected set and waits for native asynchronous command completion before releasing. Removal converges in both browsers.
- Notes and images use explicit asynchronous insertion admission; new notes/images converge in both browsers and remain after reopening.
- Image publication waits for pending image acknowledgment. Upload failure retains recovery bytes and blocks document publication.
- Shape drawing acquires a creation scope. New object IDs join that lease for subsequent updates. A failed durable transaction rolls that expansion back, permitting exact retry.
- Native effect comparison includes rich-text attributes, nested deletion, group descendants, connector endpoint relationships, metadata scopes, and page/surface child-list changes. It rejects duplicate IDs, dangling group children and cyclic groups.
- Connected idle reservation heartbeat and immediate disconnect release have focused server coverage.

## Evidence so far

- Plan 05-01 previously committed evidence remains in 05-01-SUMMARY.md.
- Production Chromium individual scenarios passed for text conflict, deletion, note insertion/reopening, image insertion/reopening, and multi-update shape drawing.
- Client document/live/mutation-guard/image suites: 51 passing tests.
- Collaboration and reservation suites: 33 passing tests in the current combined run.
- Both typechecks passed after creation admission changes. Combined production browser regression: 7 passed, 1 failed. Text conflict, deletion, note/image insertion, drawing, cold restart durability and lost-acknowledgment idempotency passed. Formatting initially failed; its focused production test passed after the two repairs below. The final combined run was interrupted: five passed, three did not run; it is not a passing gate.

## Repairs

Task 05-02-02 is being verified in smaller concerns: native existing-object commands; creation and image publication; remaining structural/metadata entry points.

- Release after native command promise completion fixed keyboard deletion.
- A new test reproduced the image-parent child-list classification rejection; classifying page and surface membership separately fixed the actual browser insertion test.
- Native shape creation lacked gesture admission. Creation scope plus transactional lease expansion passed the actual drawing test, including a save during the drag.
- Formatting repair attempt 1 separated menu disclosure from mutations: the menu stayed open, but the color did not apply. Attempt 2 replays the event at its original composed-path control instead of the retargeted outer host; the focused production browser test passed.
- Focused tests first failed for rich-text formatting, graph integrity, pending image publication, and lease expansion, then passed after implementation.

## Remaining acceptance work

- Finish the combined production browser regression after the current gesture and structural repairs. Setup timeouts were cleared by the resumed runs; newly reproduced action failures are tracked below.
- Complete explicit action inventory and coverage for rotation/resize handles, connectors including dependent endpoint changes, frames/groups, paste/import, every context/toolbar shortcut, board title/metadata, and undo/redo dispatch.
- Validate cancellation, full atomic multi-object contention, inaccessible-action explanations, and reservation status placement in the UI contract.
- Mind-map structural editing remains gated until plan 05-08.
- Keep ordinary board activation gated until full coverage is ready. Do not advance the plan count or mark COL-01 complete from these partial results.
- Preserve unrelated workspace edits. No files have been deleted.

## Latest verification gate — 2026-10-03

- The final eight-case browser run reported five passes and three unrun cases, with global execution/teardown timeouts and a large elapsed-time gap. The retry selecting the three unfinished cases timed out during plugin setup, before executing tests.
- The board-action regression found inconsistent collaboration flags in duplicate/import response descriptors. Both staging response constructors now explicitly include disabled collaboration flags; the action suite passed after that correction.
- A new metadata test first reproduced renaming while another connection held the metadata scope. The rename endpoint now acquires a request-scoped metadata reservation, rechecks it at the commit boundary, and releases it in finally. The focused metadata case passed in the subsequent suite.
- Combined collaboration/action suites initially reported 24 passes, two fixture setup timeouts and two descriptor consistency failures. After the descriptor repair and serialized retry: 27 passes, one identity-provider beforeEach timeout (the held-response revocation case). This remains a failed verification run.
- `[Node Repair - RETRY]` Verification recovery: retried unfinished browser checks and serialized server test workers. Setup timeouts repeated. Escalated at the workflow failure gate; no incomplete task is marked complete.
- Current plan 05-02 code and this checkpoint remain uncommitted. Plan 05-01 remains the last completed plan. Remaining plans have not started.
- No cause for the long execution gaps is asserted. No test limits were weakened to obtain a pass.

## Resume — 2026-10-04

- User authorized retrying verification and continuing Phase 5.
- Serialized server suites passed 41 tests across collaboration, reservations and board actions.
- Eight-case production browser retry completed with seven passes and one deletion race. Resize and rotation were added as the next action-coverage slice.

### Resumed browser result and next repair

The eight-case retry completed with seven passes and one failure. The failure is an intermittent keyboard deletion immediately after moving an object, not a setup timeout. The other cases, including cold restart, lost acknowledgment, and formatting, passed.

The native action adapter now waits for its own in-flight release before redispatching an explicit next action for fresh authorization. A deterministic browser variant delays the release response, presses Delete, then allows release. Resize and rotation are separate newly added native-handle cases. Verification is running.

| Action path | Current evidence / remaining work |
|---|---|
| Native shape movement | Two editors plus Viewer, durability and lost acknowledgment passed |
| Whole-object text session | Conflicting movement denied; independent object remains editable; release verified |
| Delete shortcut | Delayed-release deterministic repair passed in two focused runs |
| Shape drawing | Multi-update gesture converges; creation lease rollback tested |
| Sticky note insertion | Two-browser convergence and reopen passed |
| Image insertion | Upload acknowledgment, two-browser convergence and reopen passed |
| Color picker | Original composed target replay passed; menu disclosure remains navigable |
| Resize / rotation | Native corner gestures converge in both browsers after original composed target and selected-object admission repair |
| Frame / group actions | Native frame creation and grouping/ungrouping passed; populated frame movement remains pending |
| Connector editing | Endpoint dependency classification exists; native acquisition coverage pending |
| Paste / duplicate / arrange | Native clipboard paste, duplicate, grouping/ungrouping and context-menu alignment passed; remaining arrange/lock paths pending |
| Undo / redo | Semantic history footprint unit tests passed; native dispatch verification running; personal eligibility belongs to plan 04 |
| Board rename | Request-scoped metadata admission and existing board actions passed; live UI propagation pending |
| Mind-map structure | Gated until plan 08 |

### Native handle verification and structural expansion

- Focused deletion/resize/rotation run first passed deletion and reproduced two handle failures: resize obtained permission but lost its native event target; rotation outside the shape received no admission. Preserving the original composed target and deriving handle targets from selection resolved both. All three production cases passed together; both typechecks passed.
- New duplication and grouping cases first failed with unchanged object counts. Explicit asynchronous reservation wrappers now cover duplication, grouping and ungrouping, with selection rechecks and error handling in keyboard, context-menu and layer-panel callers. Both focused production cases passed, including ungrouping and remote convergence.
- Context-menu alignment first failed without an acquired lease; wrapping the selection mutation passed. Native paste first required a test correction to inspect its HTML clipboard payload, then reproduced missing creation admission. Its native asynchronous handler now snapshots clipboard input before awaiting permission and retains the creation lease until completion. Both alignment and paste production cases passed together. Client static checking passed.
- Expanded combined regression passed all 29 production cases: 15 existing local arrangement cases, 12 reservation cases and two collaboration durability/idempotency cases. No mandatory skips or retries.
- Three additional creation cases passed: native frame, freehand and drawn text box with focused text entry; all converge in both browsers.
- Undo with no selected object first failed. Added semantic native-history footprint tracking, with two passing unit tests covering merged effects, remote exclusion, redo and deleted-object restoration. Native undo/redo dispatch now uses those targets and is being verified. Client static checking passed.
- Remaining action coverage and full regression are still required. No plan completion is claimed.

### Additional native-action coverage

- Native undo/redo with an empty selection passed after semantic history admission was installed.
- Group contention first exposed a generic denial message; authenticated holder names now appear. Grouping and ungrouping passed together.
- Native frames use `prop:childElementIds`. Server effect classification now includes these descendants; 14 reservation unit tests passed.
- Connector and populated-frame creation use private previews until the complete endpoint/contained-object set is known. Empty frame, connector and populated-frame production cases passed together. Escape cancellation and atomic endpoint contention also passed after restoring keyboard focus to the canvas.
- Layer ordering and permanent lock/unlock first failed without admission; asynchronous action wrappers now pass both production cases, including remote convergence.
- Live rename first failed before SQL persistence. The live path now waits for preceding document saves, checks fresh title authority, preserves uncertain operation identities, and uses the metadata reservation. Native rename, server persistence and remote title propagation passed. Received titles update a read-only projection without generating document edits.
- Latest server regression: 42 passed across collaboration, reservations and board actions. Latest client regression: 82 passed across seven suites, including title intents and read-only title projection. Both static checks passed before the next test expansion.
- A 21-case production reservation regression is in progress. One note scenario timed out; the failure remains unresolved. Added separate pending checks for numeric thickness, typography, cut and delayed rename response ordering. These new cases have not yet been run.
- Remaining inventory includes native overflow creation, numeric/custom formatting, external selection controls, connector endpoint retargeting/quick-add, populated frame transforms, eraser, cut, asynchronous target-set revalidation and cancellation/disconnection coverage. Plan 05-02 remains incomplete and uncommitted.

### Timing and form-control verification

- The completed 21-case reservation run passed 18 and failed three. Note and populated-frame cases timed out awaiting the initial text-holder conflict response; history lost an explicit Redo while Undo was still releasing its lease. These were retained as failures.
- History now retains one explicit next history action while its own prior lease finishes. A delayed-release Undo/Redo test passes.
- Text focus-out handling now examines the settled focused editable through shadow boundaries before releasing its reservation.
- New native numeric thickness, typography, Cut and delayed-rename cases all first reproduced failures. Numeric input/select events and captured input values now participate in admission; Cut holds its complete footprint through the asynchronous clipboard handler; live metadata is retained while a title request is in flight, so its late response cannot hide a newer server title.
- First repair run: six of seven passed; typography still failed because native change events inside the toolbar shadow root never reached host capture. Dali typography controls now invoke reservation handling directly.
- Repeated typography, text-session/note and delayed history verification passed all nine cases (three repetitions each). No mandatory skips or retries. Remaining native overflow/eraser cases are now being verified; no plan completion is claimed.

### Overflow, eraser and inspector verification

- Native overflow Duplicate and Frame selection first failed with unchanged object counts. Duplicate now uses the asynchronous copy action; frame commands acquire creation plus complete selected-object scope before native dispatch. Both passed.
- Eraser first failed to remove its target. Its stroke now remains a private preview until all affected objects are admitted, then native deletion occurs in one transaction. The browser check passed both denied multi-object erasing (unchanged opacity/content) and allowed deletion after release.
- One added eraser assertion initially failed static checking because block models lack the canvas opacity property. The test now narrows the model type; client static checking passes.
- Native note-size and image-properties controls first failed without reservation admission. Note sizing and image geometry/brightness now pass with two-browser convergence and reopen.
- Image adjustment records are included with their owning image. A new unit test first failed, then passed with the classifier correction; all 15 reservation unit tests pass. Read-only image settings lookup no longer creates adjustment records; mutation reconciliation is scoped to the target image.
- Connector endpoint retargeting is the next pending browser check. Remaining action inventory and final combined regression are still required.

### Latest combined verification and failure checkpoint

- Connector endpoint retargeting first failed to reserve its new destination. A private endpoint preview followed by complete-footprint admission now passes denial without mutation and allowed retargeting after release, with remote convergence.
- Connector quick-add first left its endpoint unattached. Creation plus connector admission now passes connected shape creation and remote convergence.
- Latest production Chromium regression: **62 passed, 1 failed**, across collaboration reservations, collaboration durability, canvas arrangement, image visual edits, and UI refinements. No skipped or retried cases. This is a failed verification gate.
- Failure: Task 05-02-02, typography immediately after another formatting action. Font size becomes 48, but selecting Bold leaves fontWeight at 400 instead of 700. The trace and failure context are retained in local test results. A preceding action still holding its reservation is a suspected cause, pending deterministic diagnosis.
- Typography repair 1 routed generic form events and captured values; font-size mutation still failed. Repair 2 invoked admission directly from the typography controls; focused repetitions passed, but the combined run exposed the sequential Bold failure. The two-attempt repair budget is exhausted; escalate with Retry / Skip (mark incomplete) / Stop (investigate).
- Latest serialized server regression: **43/43** across three suites. Latest client regression: **82/82** across seven suites. Client and server static checks and whitespace validation passed.
- Plan 05-02 remains incomplete and uncommitted. Plan 05-01 remains the only verified Phase 5 plan; plans 05-03 through 05-09 remain unstarted. Ordinary boards retain the existing opt-in live activation boundary.

Remaining acceptance inventory: resolve sequential typography admission; native group/multi-object lock and release-from-group paths; populated-frame movement, resize membership changes and deletion; derived-footprint revalidation after asynchronous admission; acquisition cancellation and disconnect browser coverage; complete live image reset/crop/replacement coverage; and the final combined regression. Previously recorded passing tests do not replace these missing checks.

### 2026-10-05 issue tracking and timeout verification

The user requested a GitHub issue for the remaining formatting failure, a fresh check of the earlier setup/startup timeout report, correction of recurring timeouts, and continued execution. Created https://github.com/faocampo/dali/issues/1 with reproduction, observed results, suspected admission timing and acceptance criteria. Tracking this issue does not satisfy the typography acceptance gate.

- Fresh focused server run: 43/43 passed, without setup timeouts. Both static checks passed.
- Fresh production browser regression: 62 passed, 1 failed (typography), completed in 7.5 minutes. No setup/startup timeout, required skip, or retry. The older report of repeated setup/startup timeouts no longer describes this run.
- Expanded full serialized server suite: 348/349 passed. The corrupt-backup rejection test exceeded its default five-second test-body budget; this was not a beforeEach/server-startup failure. The isolated restore suite passed 11/11. Its rejection cases perform real backup publication and filesystem synchronization before asserting unchanged source/destination state. Those eight cases now have a bounded 15-second allowance; all integrity assertions remain. A full rerun is pending.
- Continued with new two-editor browser checks for native toolbar grouping and multi-object locking, including remote convergence and ungrouping. Their initial verification is pending.

### Timeout correction and continued native-action coverage

- Full serialized server rerun after the scoped disk-I/O allowance: **349/349 passed across 16 suites**, in 202.88 seconds. No setup timeout, skip or retry. The correction changes only the restore rejection test budget from the framework default of five seconds to 15 seconds; production behavior and integrity assertions are unchanged.
- Fresh client regression: **82/82 passed** across seven suites.
- Added native Group and multi-object Lock checks. Both first failed with two unchanged shapes instead of a new group. Native creation admission now covers toolbar/overflow group creation and multi-object locking, acquiring selected-object dependencies plus creation scope before dispatch.
- First repair run: native frame creation and native Group passed; multi-object Lock created and converged correctly but the test timed out on an incorrect button label. The native control is “Click to unlock” and releases the temporary group directly. Corrected that test expectation; final two-case verification passed 2/2, including remote convergence and native unlock/ungroup. Both static checks and whitespace validation passed again.
- The earlier typography failure remains open in GitHub issue #1. The full 63-case browser run remains a failed functional gate despite successful setup/startup. No Phase 5 completion or general production activation is claimed.

Current disposition: setup/startup timeout concern did not reproduce in completed browser runs or server setup. A separate disk-backed test-body timeout was reproduced and corrected with a scoped integration-test budget; the complete server rerun passed. Continued native group/lock admission is verified. Issue #1 remains open; plan 05-02 remains incomplete and local changes are uncommitted. Still required: typography sequential admission, release-from-group coverage, populated-frame movement/resize-membership/deletion, asynchronous footprint revalidation, acquisition cancellation/disconnect browser cases, remaining live image control coverage, and a passing combined functional regression.
