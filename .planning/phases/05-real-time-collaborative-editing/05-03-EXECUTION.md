# Plan 05-03 execution checkpoint

Historical checkpoint. The user authorized continuation on 2026-10-06. The coordinate and publication-error repairs and the 83/83 Chromium refresh are recorded in [05-RESUMPTION-2026-10-06.md](05-RESUMPTION-2026-10-06.md); the current plan disposition is in [05-03-SUMMARY.md](05-03-SUMMARY.md). The failed evidence below is retained and the old retry-choice request is no longer an authorization blocker.

Status: tracer committed in `e9a7b82`; UI expansion committed in `ca34104`; combined browser regression passed, but added native coordinate verification is blocked after two repairs. Plan 05-02's current automated gate passed 71/71 production browser cases; typography remains in user-requested backlog 999.8 with historical failure evidence.

## Verified tracer

- Server-derived participant identity and current effective board role; Viewer cursor/selection fields are stripped, including after downgrade.
- Ephemeral bounded cursor/selection packets reject forged identity fields, invalid coordinates and oversized selections.
- Accounts aggregate across tabs, using server activity order. Connected idle participants remain present; detected disconnects remove their session immediately.
- Presence has a separate hashed delivery cursor, so presence-only responses do not apply document updates.
- Header disclosure shows the roster; transparent canvas overlays show remote editor cursors/selections. Current user ordering, role labels and pointer transparency are implemented.
- New authenticated browser tracer first failed because the participant control was absent. After implementation it passed twice, including editor/Viewer filtering, selection projection, keyboard dismissal/focus return and disconnect removal.
- Server suites passed **26/26** after extending one exact heartbeat assertion to include presence fields while retaining its content-free response requirement. Both static checks passed. Initial implementation type errors were corrected before browser verification.

## Pending expansion

A five-case production run checks tabs, narrow/scaled layout, idle fading, error/retry, and a roster above twenty people. The many-person case creates distinct signed synthetic identities and API presence connections to verify roster projection; it does not establish simultaneous native coediting, which belongs to Plan 05-09.

The narrow-layout screenshot was inspected: participant names wrap, roles remain readable, the panel stays within the viewport, and canvas controls remain reachable. Browser page scaling and native browser zoom are distinct; only evidence actually exercised may be claimed.

Still required: finish expansion and resolve failures; loading/only-self/partial-name cases; final integrated regression; preserve any human-only UI judgments for phase acceptance. Plan 05-03 is incomplete.

## Expansion evidence and repairs

- First five-case expansion: **4 passed, 1 failed**. Tabs, idle/reactivation, error/retry and a 21-person roster passed. The layout case stalled after page-scale emulation changed the visual viewport and the automation clicked a different header control. Narrow layout itself passed and was visually inspected.
- A corrected eight-case run passed **7/8**. The initial loading case remained behind the application's existing whole-board opening boundary. Adding a header fallback alone could not expose it while the connection itself was held.
- The second loading repair moves initial presence delivery to the first poll. The document connection completes independently; the roster remains explicitly loading until its own response arrives. The test now delays that poll. Current full presence verification is in progress.
- Compact-layout coverage now uses actual 390px and 640px CSS viewports. Native browser-chrome 200% zoom remains a separate human acceptance judgment; page-scale or device emulation is not reported as proof of it.
- Full client regression: **250/250 passed across 22 files** before the initial-delivery adjustment. Both static checks pass after that adjustment; a current integrated gate remains required.

## Current expansion gate

At implementation revision `ca34104`:

- Production Chromium presence suite: **8/8 passed**, zero skips/retries, 2.2 minutes. The second loading repair passed with the board open while its first presence response was delayed.
- Full client suite: **250/250 passed across 22 files** after the delivery adjustment.
- Full server suite: **354/354 passed across 17 files**, 69.29 seconds; no setup timeout. This run used the default worker configuration.
- Client/server typechecks and whitespace checks passed before the implementation commit.
- Narrow, compact and 21-participant screenshots were inspected. Names wrap and the roster scrolls inside the viewport. Native browser zoom remains phase-level human acceptance.
- Combined native canvas, reservations, durability, images, typography and presence production-browser regression is running. Plan completion awaits that result.

## Coordinate verification checkpoint

The combined regression at `ca34104` passed **79/79**, zero skips/retries, 9.1 minutes. It covers all eight presence cases plus native reservations, arrangement, images, durability and UI refinements. The typography case passed again; backlog 999.8 remains open because its known race was not repaired.

An additional native canvas zoom/pan assertion then exposed an unresolved coordinate discrepancy. This is separate from native browser-chrome zoom.

1. Initial added check failed after canvas zoom: expected `(520, 392)`, observed `(520, 358)`. The expected point was calculated after editor focus, which could change its viewport after the original pointer event; this result alone does not establish a rendering defect.
2. **RETRY 1:** Use native viewport bounds for overlays and its view scale for selection sizes; validate the baseline before zoom. The test failed at baseline: expected `(400, 418)`, observed `(400, 350)`.
3. **RETRY 2:** Derive the test point from the actual authenticated pointer packet rather than a later viewport sample. Baseline and 50% canvas zoom passed. After the native Hand gesture, expected `(620, 408)`, observed `(620, 476)`. The cause remains unresolved; distinguish viewport scrolling/layout-origin changes from a stale test expectation before further repair.

**ESCALATE:** The two-attempt repair budget is exhausted. Plan 05-03 is incomplete; Plan 05-04 has not begun. Await Retry, Skip (explicitly incomplete), or Stop/investigate. Current local changes in the presence overlay and its browser test are preserved and uncommitted. Both TypeScript checks passed after the second repair; the focused browser test failed. No regression process remains running. Earlier 79/79, 250/250 and 354/354 results retain their exact source scope and do not validate the pending overlay changes.

The native-browser 200% zoom and final presence UX review remain phase-level human acceptance obligations. General collaboration activation remains gated. No phase requirement is marked complete.
