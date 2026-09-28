# Phase 4 — UI review

**Audited:** 2026-09-28, inline against [04-UI-SPEC.md](04-UI-SPEC.md).
**Source:** `e93b933` with the tracked working-tree identity recorded by the final matrix reporter.
**Visual evidence:** Existing synthetic screenshots from the current native Firefox run were inspected: Save Details with 50 failed images at narrow/short dimensions, unpreserved-work leave confirmation, and the 320px library recovery list. Captures remain in ignored `test-results/`. No additional browser session or private-board capture was used.
**Interaction evidence:** Existing native test assertions; no separate interaction recording. The complete regression is still running; its final verdict belongs in [recovery acceptance](../../../docs/recovery-acceptance.md).

## Pillar scores

| Pillar | Score | Finding |
|---|---|---|
| Copywriting | 4/4 | State-specific guidance explains retry, retained work, image uploads and explicit leave risk. The redundant Select image control is removed under the user's instruction. |
| Visuals | 4/4 | Inspected panels preserve heading/action hierarchy, visible focus and bounded scrolling; library markers remain subordinate to board identity. |
| Color | 4/4 | Logo-derived tokens separate accent, success, pending and failure; explicit words accompany color. Rendered contrast checks exercise recovery surfaces. |
| Typography | 3/4 | Save Details follows the four-size contract. Recovery/leave headings retain 1.4 line height rather than the declared 1.2; leave actions use 14px rather than 13px. |
| Spacing | 3/4 | Save Details and leave confirmation use the declared spacing and 44px targets. The older recovery-action selector retains 12px horizontal padding rather than 16px. |
| Experience design | 4/4 | Current native checks cover pending/error/empty states, focus restoration, duplicate-action suppression, archive integrity and preservation through navigation. |

**Initial sampled visual score: 22/24.** Subsequent repeated execution found WebKit focus loss after recovery in `tests/local-recovery.spec.ts:116`. Experience design is revised to **2/4**, giving **20/24**, with a blocking focus-retention finding under G-04-38. The screenshots alone did not reveal this timing-dependent behavior.

## Follow-up recommendations

**Blocking:** Diagnose and fix recovery stealing the user's intervening focus in WebKit. Preserve the final focus assertion; 31/32 focused cases passed, with one failure after editor visibility. Plan 04-17 owns this work.

1. Align recovery/leave heading line height and leave-action font size with the contract in a later UI polish pass. Source: `src/index.css` selectors `.board-recovery h1`, `.leave-recovery-dialog h2`, `.leave-recovery-actions button`.
2. Align `.board-recovery__actions button, .board-recovery__actions a` horizontal padding with the 16px contract. Current controls retain their 44px minimum height and wrapping.

These are minor visual-contract differences. They do not invalidate the tested recovery, reachability or preservation behaviors. No third issue was established.

## Evidence and scope

- `src/header/SaveDetails.tsx` and `src/header/save-details.css`: stable escaped labels, scoped previews, 12/13/14/20px hierarchy, status-specific copy, viewport clamping, keyboard dismissal and focus restoration.
- `src/header/LeaveRecoveryDialog.tsx` and `src/index.css`: explicit unpreserved-work warning, initially focused Stay action, modal keyboard behavior, duplicate navigation guard and narrow action stacking.
- `src/canvas/RecoveryStateView.tsx`: distinct corrupt, restoration mismatch, access-change and pending states with bounded actions.
- `src/styles/tokens.css`: shared violet accent, neutral surfaces, semantic status colors and font/spacing tokens.
- `tests/save-details.spec.ts`, `tests/recovery-navigation.spec.ts`, `tests/library-recovery.spec.ts` and `tests/recovery-ui-matrix.spec.ts`: current rendered/native checks, including long labels, 50 rows, 320px layouts, contrast, accessible names, focus and real archive handoff.

The screenshot review samples three recovery states. Complete UI predicate coverage is supplied by the required 36-key matrix in each production engine. Native 200% zoom and visible tab-close behavior are separately accepted by user report, scoped to the tested environment; browser/version was unspecified. Spoken assistive-technology testing remains deferred to backlog 999.3.

## Registry safety

This phase uses the existing local component and token system. No registry component or new package was introduced by this acceptance continuation.
