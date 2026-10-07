---
phase: 01-editable-canvas-and-image-portability
status: secured
verdict: SECURED
audited_revision: 010a276
asvs_level: 1
block_on: high
threats_total: 17
threats_closed: 17
threats_open: 0
---

> Current disposition (2026-09-11): The approved 15-commit metadata rewrite is complete and verified. The user clarified that personal Git authorship is permitted. The authorship-based publication concern below is resolved; historical audit wording is retained for traceability. Private organizational information remains prohibited. See [01-HISTORY-REMEDIATION.md](01-HISTORY-REMEDIATION.md). Image import and copy/paste feature acceptance is recorded in 01-UAT.md.


# Phase 1 Security Audit

## Closure refresh — 2026-09-12

The plan-authored 17-threat register remains closed at ASVS level 1. Source inspection and current regression coverage retain input size/decode limits, stale-operation guards, source preservation, export allocation limits, and selected-object isolation. All 256 browser cases passed. The original independent audit follows as historical evidence; its authorship blocker was resolved by the approved remediation and clarified privacy boundary.

## Historical independent audit

Independent source and regression-assertion review closed 15 of 17 registered threats. Two high-severity entries share one remaining publication-history cause. Runtime fixes were independently rechecked; reported browser results were not rerun by the security auditor.

## Publication blocker

| Threat | Severity | Evidence | Required action |
|---|---|---|---|
| T-01-PRIV | high | Fifteen implementation commits after planning retain personal author/committer metadata. | Obtain reviewed approval and anonymize affected local metadata before publication. |
| T-04-PRIV | high | Six export task/evidence commits are part of the same affected set. | Same remediation; this is one underlying history issue, not a second data leak. |

User approval for metadata-only remediation was requested and remains pending. No history rewrite or push was performed. Proposed identity is the synthetic `Dali Contributors <contributors@example.org>`. File contents and messages remain unchanged; descendants receive new hashes. Remote history is outside the proposed change. Publication stays blocked.

## Closed threats

| Threat | Verified mitigation |
|---|---|
| T-01-SC | All 19 direct exact npm integrity values independently matched the lockfile; 541 lockfile entries have integrity and credential-free registry resolutions. |
| T-01-LIFE | Mount cancellation/disposal and local reload/switching tests. |
| T-02-INPUT | Host, editability, focus, composition, lock and finite-geometry guards. |
| T-02-TEXT | Native HTML AST/text-delta processing and inert script/event-attribute tests. |
| T-02-PRIV | Synthetic canvas fixtures and excluded generated browser output. |
| T-03-SIZE | Shared byte/header/decoded-pixel limits and decode deadline; plain-text SVG rejected before native fallback; replacement validates before storage. |
| T-03-ACTIVE | PNG/JPEG byte-signature and decoder validation; no established script-execution finding. |
| T-03-PRIV | Synthetic image fixtures; generic errors omit filenames, paths and contents. |
| T-03-RACE | Host/store/board/image/source guards after validation and storage, immediately before replacement mutation; board-change/unmount regressions. |
| T-04-MEM | Finite/safe side/pixel bounds and intermediate-layer preflight before allocation; canvas cleanup. |
| T-04-ASSET | Bounded asset/font/decode/render preparation, origin-clean and encoder-null/error handling. |
| T-04-STALE | Document/board/selection revision checks before and after rendering; preview-plan dispatch. |
| T-05-SCOPE | Recursive selection identity, native layer order, frame intersection and clipped pixel tests. |
| T-05-GEOM | Bounded integer padding, valid frame rectangle and oversized-intermediate regression. |
| T-05-RACE | Frozen export plan and freshness checks. |

## Recheck evidence

T-03-SIZE: `src/canvas/image-input.ts` capture and validation; `src/canvas/image-visual-edits.ts` shared replacement validation; `tests/image-import.spec.ts` SVG rejection/raster retry; `tests/image-visual-edits.spec.ts` replacement preflight.

T-03-RACE: replacement identity checks in `src/canvas/image-visual-edits.ts`; host supplied by `SelectionInspector.tsx`; delayed storage, board-change, retry and actual unmount assertions in `tests/image-visual-edits.spec.ts`.

See [01-REVIEW-FIX.md](01-REVIEW-FIX.md) (five atomic fixes and passed validation) and [01-VERIFICATION.md](01-VERIFICATION.md) (independent product checks).

## Dependency observation

Nested Vitest/mocker 3.2.7 remains inherited; the direct runner is 4.1.11. The inspected configuration registers no mocker/interceptor development-server plugin, so the audit found no demonstrated exposure to the redirect-mock advisory in this configuration. Retain the observation for future configuration changes. Source: GitHub Advisory Database ([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)).
