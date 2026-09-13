---
phase: "02"
slug: daily-mind-maps
status: verified
threats_open: 0
asvs_level: 1
register_authored_at_plan_time: true
created: "2026-09-13"
---

# Phase 2 — Security

Audited implementation revisions: `e52dab1`, with copy-boundary remediation `a5c6f8d`. Inline orchestrator L1 review of the plan-authored register, source and named tests. The L1 short-circuit in secure-phase applies after every planned mitigation is found. No security-agent dispatch is claimed. This audit covers local canvas boundaries; authentication and multi-user authorization retain their later phase allocation.

## Trust boundaries

- User text and clipboard data enter native rich-text and hierarchy conversion.
- Canvas commands and deferred callbacks mutate the current editable document.
- Visibility and selection determine exported membership, bounds and pixels.
- Synthetic test evidence and publishable history cross the public repository boundary.

## Threat register

The six plans contain 22 rows and 20 distinct IDs. T-02-05 and T-02-06 are reused across plans for different components; plan-qualified rows preserve all original obligations.

| Plan / ID | Category | Component | Severity | Disposition | Status | Source and test evidence |
|---|---|---|---|---|---|---|
| 02-01 / T-02-01 | Tampering / E | mindmap.ts labels | high | mitigate | CLOSED | `mindmap.ts` insertMindmap/addTopic and native rich text; `mindmap-formatting.spec.ts` inert markup and exact international labels. |
| 02-01 / T-02-03 | Tampering | compatibility/history | high | mitigate | CLOSED | `mindmap.ts` changeMindmap and `mindmap-compatibility.ts` layout/collapse snapshots; compatibility and collapse fault/Undo cases. |
| 02-01 / T-02-05 | Tampering | copy and deferred layout | high | mitigate | CLOSED | Copy: `withNativeCopySources` and final CRUD current guard; copy stale-source cases. Keyboard: `mindmap-keyboard.ts` composed-path/composition/repeat guards; keyboard exact-count cases. |
| 02-01 / T-02-06 | Denial of service | malformed native conversion | high | mitigate | CLOSED | `validateMindmapCopyData`, `validateMindmapState`, assertMutableMap preflight; malformed copy/collapse cases, unchanged serialized content. |
| 02-02 / T-02-18 | Tampering | native clipboard and board-copy routes | high | mitigate | CLOSED | Native copy converter retains ID remapping; document transformer independent scope; copy complete-child-record and independent-edit tests. |
| 02-02 / T-02-19 | Tampering / E | queued duplicate mutation | high | mitigate | CLOSED | Invocation-time source capture, withNativeCopySources and final CRUD guard; removed/detached/readonly/locked source cancellation tests. |
| 02-02 / T-02-20 | Denial of service | copied hierarchy | high | mitigate | CLOSED | validateMindmapCopyData rejects invalid identities/parents/cycles/geometry before converter writes; malformed clipboard cases. |
| 02-03 / T-02-05 | Tampering | keyboard routing | medium | mitigate | CLOSED | Copy: `withNativeCopySources` and final CRUD current guard; copy stale-source cases. Keyboard: `mindmap-keyboard.ts` composed-path/composition/repeat guards; keyboard exact-count cases. |
| 02-03 / T-02-06 | Tampering | hierarchy commands | high | mitigate | CLOSED | `validateMindmapCopyData`, `validateMindmapState`, assertMutableMap preflight; malformed copy/collapse cases, unchanged serialized content. |
| 02-03 / T-02-07 | Denial of service | derived visibility and native observers | high | mitigate | CLOSED | Iterative visited traversal with 3N budget and depth guard before native recursion; state 12000-node chain and collapse repeated-toggle cases. |
| 02-03 / T-02-08 | Tampering / E | deferred command lifecycle | high | mitigate | CLOSED | assertMutableMap plus connected/current-store/read-only/descendant-lock checks; keyboard guards and disposed callback cases. |
| 02-03 / T-02-09 | Information disclosure | hidden selection/layers | medium | mitigate | CLOSED | `selection-summary.ts` effective visibility and compatibility grid/selection guards; visibility Layers, pointer, marquee and navigation cases. |
| 02-04 / T-02-21 | Tampering | arrangement and deletion | high | mitigate | CLOSED | Arrangement guards and CRUD removeElement validate full affected hierarchy and descendant locks; subtree delete/Undo and ordinary-object cases. |
| 02-04 / T-02-22 | Information disclosure | hidden selection/Layers | medium | mitigate | CLOSED | Effective visibility shared by selection summary, Layers and native grid wrapper; all visibility selection-surface cases. |
| 02-05 / T-02-10 | Denial of service | layout scheduling | high | mitigate | CLOSED | Compatibility arranging/writable guards, finite topology preflight and depth bound; layout 7/50-topic direction, anchor and failure cases. |
| 02-05 / T-02-11 | Tampering | style and layout writes | high | mitigate | CLOSED | changeMindmap captures native Y fields/details, restores on failure; layout/formatting identity, typography and history assertions. |
| 02-05 / T-02-12 | Tampering / E | label/format controls | high | mitigate | CLOSED | formatMindmapTopic size/weight/color allowlists and native rich text; formatting empty, Unicode and inert markup cases. |
| 02-05 / T-02-13 | Spoofing | control/failure state | medium | mitigate | CLOSED | `MindMapInspector.tsx` disabled/pressed/live/error controls; accessibility focus, readonly, contrast and retry cases. |
| 02-06 / T-02-14 | Information disclosure | mindmap-export.ts / native edge adapter | high | mitigate | CLOSED | `mindmapExportSnapshot` effective visibility and selected endpoint membership before bounds/drawing; export sibling/hidden decoded pixel exclusions. |
| 02-06 / T-02-15 | Denial of service | export preflight | high | mitigate | CLOSED | Tree depth preflight and existing `export-plan.ts` side/area/intermediate raster limits; oversized visible and hidden-distant export cases. |
| 02-06 / T-02-16 | Tampering | render lifecycle | high | mitigate | CLOSED | Frozen export membership snapshots, host/document/selection revision assertion and no temporary writes; stale export and before/after native state tests. |
| 02-06 / T-02-17 | Information disclosure | public evidence | high | mitigate | CLOSED | Reviewed phase diff and commit metadata; fixtures use synthetic labels/pixels and relative repository references. Personal Git attribution is permitted by AGENTS.md. User-owned image directory remains untracked. |

## Accepted risks

None. Native OS input evidence remains a separate UAT limitation in WINDOWS.md; simulated events do not prove native clipboard/IME behavior.

## Audit trail

| Date | Register rows | Closed | Open | Method |
|---|---:|---:|---:|---|
| 2026-09-13 | 22 | 22 | 0 | Inline L1 mitigation-presence review; passing 604-case browser gate and 67 unit cases from 02-06 execution |

Post-audit adversarial review found inconsistent empty/duplicate sibling order validation and excessive depth at the clipboard boundary. Commit `a5c6f8d` unifies that preflight with the canonical validator and rejects depth above 128 before conversion. Empty order, duplicate sibling order and excessive depth failed exact-document RED assertions, then all 68 copy cases passed across four projects. T-02-06 (02-01) and T-02-20 (02-02) are CLOSED after this correction; 67 unit cases, typecheck and build also passed. No risk acceptance was invented. Final staged privacy review remains required before each commit.
