# Phase 1 Planning Audit

Plans are executable instructions; runtime evidence remains pending.

## Dependency and Ownership Map

| Plan | Wave | Needs | Creates |
|---|---|---|---|
| 01-01 | 1 | Pinned public source; verified registry access | Real local edit/write/read, maintained build, shared test configuration |
| 01-02 | 2 | 01-01 native editor | Left tools, complete primitive editing and arrangement |
| 01-04 | 2 | 01-01 editor/rendering baseline | Native scale proof, whole-board PNG, limits/recovery |
| 01-03 | 3 | 01-02 control changes | Picker/drop/paste and persisted images |
| 01-05 | 4 | 01-03 image workflow and 01-04 export contract | Selected-group/frame PNG and combined workflow |

Same-wave plans 01-02 and 01-04 have disjoint files and use isolated browser contexts. They both read the native document API but mutate separate fixtures. Run their browser verification serially if sharing fixed dev/prod ports; do not change shared server/config state concurrently.

All tasks have at most five behavioral file edits. 01-01-01 has an explicit mechanical-incorporation exception for a pinned 45-file dependency closure, including the required tsconfig path map and generator; copying this closure remains one runnable tracer. Two tasks per plan. Estimates use factor 1 and low confidence from zero project calibration samples.

## Multi-Source Coverage

| SOURCE | ID | Feature/constraint | Plan | Status |
|---|---|---|---|---|
| GOAL | Phase 1 | Editable compositions, images and useful exports | 01–05 | COVERED |
| REQ | CAN-01 | All seven primitives, pan/zoom | 01,02 | COVERED |
| REQ | CAN-02 | Select/move/resize/group/align/duplicate/layer/style | 02,03 | COVERED |
| REQ | IMG-01 | Import and arrange local references | 03 | COVERED |
| REQ | IMG-02 | Visible mixed-content image export | 04,05 | COVERED |
| REQ | IMG-03 | Selected shapes only | 05 | COVERED |
| CONTEXT | D-01 | Left tools | 02 | COVERED |
| CONTEXT | D-02 | Context controls | 02 | COVERED |
| CONTEXT | D-03 | Familiar shortcuts | 02 | COVERED |
| CONTEXT | D-04 | Picker/drop/paste | 03 | COVERED |
| CONTEXT | D-05 | Image proportions | 03 | COVERED |
| CONTEXT | D-06 | Drop/paste placement | 03 | COVERED |
| CONTEXT | D-07 | PNG 1x/2x/4x | 04 | COVERED |
| CONTEXT | D-08 | White/transparent | 04 | COVERED |
| CONTEXT | D-09 | Preview dimensions | 04 | COVERED |
| CONTEXT | D-10 | Measured bounds and explicit lower scale | 04 | COVERED |
| CONTEXT | D-11 | Three export areas | 04,05 | COVERED |
| CONTEXT | D-12 | Selected descendants; exclude others | 05 | COVERED |
| CONTEXT | D-13 | Tight crop and optional padding | 05 | COVERED |
| CONTEXT | D-14 | Selected/grouped connector membership | 05 | COVERED |
| CONTEXT | D-15 | Frame content and clipping | 05 | COVERED |
| RESEARCH | R1 | Source pin, complete closure, notices, storage keys, privacy | 01 | COVERED |
| RESEARCH | R2 | Package provenance, exact baseline, isolated maintained toolchain | 01 | COVERED |
| RESEARCH | R3 | ES2022/decorator/CSS and native lifecycle | 01,02 | COVERED |
| RESEARCH | R4 | Native commands, lock/history and focus guards | 02 | COVERED |
| RESEARCH | R5 | Installed image APIs and event ownership; bounded decode, placement/retry | 03 | COVERED |
| RESEARCH | R6 | Installed native source-scale proof before adapter adoption | 04 | COVERED |
| RESEARCH | R7 | Shared membership/bounds/dimensions/limits; stale-plan check | 04,05 | COVERED |
| RESEARCH | R8 | Mixed primitive/DOM order, asset readiness, finally cleanup | 04,05 | COVERED |
| RESEARCH | R9 | Test discovery, automatic error fixture and missing-test controls | 01 | COVERED |
| RESEARCH | R10 | Synthetic mixed fixtures, downloaded PNG and DPR/zoom/detail oracles | 04,05 | COVERED |
| RESEARCH | R11 | Browser bounds, failure recovery, cross-browser/OS evidence limits | 03–05 | COVERED |
| RESEARCH | R12 | ASVS L1, high threshold, scoped security mitigations | 01–05 | COVERED |

All five requirements and fifteen decisions are covered. Later-phase and explicitly deferred scope is excluded by the approved roadmap.

## Spec-less Edge Coverage

All 13 surfaced items are retained: 12 resolved with explicit planned assertions and one flagged unresolved assumption. These are planning resolutions, not passed tests.

| Requirement/category | Status | Explicit predicate or flagged assumption | Task |
|---|---|---|---|
| CAN-01/empty | resolved | Empty canvas usable; one create produces one object | 01-01-01 |
| CAN-01/encoding | resolved | Combining marks/emoji/Unicode survive editing and reload unchanged | 01-02-01 |
| CAN-01/idempotency | resolved | Repeated mounts/reopen create no duplicate object/listener | 01-01-01 |
| CAN-01/concurrency | resolved | Late local mount/operation cannot affect newly active board | 01-01-01 |
| CAN-02/adjacency | resolved | Touching objects retain separate native IDs | 01-02-02 |
| CAN-02/empty | resolved | Inapplicable empty/single selection actions cause no mutation | 01-02-02 |
| CAN-02/ordering | resolved | Equal coordinates/layers retain native stable order | 01-02-02 |
| IMG-01/unclassified | unresolved | Exact full format list unspecified; PNG/JPEG minimum and supported-format evidence; carry assumption to verification | 01-03 |
| IMG-02/empty | resolved | Empty board disabled; single visible object valid; invalid geometry rejected | 01-04-02 |
| IMG-02/encoding | resolved | Decoded PNG signature/dimensions/text evidence; encode error permits retry | 01-04 |
| IMG-03/adjacency | resolved | Explicit selected membership; frame positive visible intersection and exact clip | 01-05 |
| IMG-03/empty | resolved | Empty selection disabled; valid empty frame has rectangular background | 01-05 |
| IMG-03/ordering | resolved | Selection permutations/equal geometry preserve native layer order | 01-05 |

Concurrency here means the local lifecycle. Multiuser guarantees belong to Phase 5.

## Prohibition Recall

The recall considered duplicate objects, broken focus, geometry error, incorrect ordering, missing images, oversized allocation, lost text, wrong alpha, silent scale substitution and publication of private evidence. Routine correctness items are covered by explicit edge/behavior tests. Injection and general security canon are referred to the threat models and GSD security verification.

Two bespoke prohibitions survive: public repository privacy and honest export resolution/completeness. They were projected through the installed projectProhibitions serializer into plan 01 and plan 04 must_haves.prohibitions, descriptor-less and unresolved, retaining flagged-unverified disposition. No fabricated wired-check descriptor or automatic dismissal is used.

## Capability Contributions

Consumed active planner contributions for API coverage, assumption delta, schema detection and security. Canvas entity remains the primary noun; the detected "alongside" signal causes no identity-model change. No ORM schema path exists in this phase. The orchestrator UI gate reports frontend=true, block=false, hasUiSpec=false; approved context supplies concrete layout defaults. Local native library APIs are inspected and tested before use.

## Inputs

[01-CONTEXT.md](01-CONTEXT.md) (locked decisions); [01-RESEARCH.md](01-RESEARCH.md) (pinned source findings and runtime gates); [01-PATTERNS.md](01-PATTERNS.md) (verified source analogs); [01-VALIDATION.md](01-VALIDATION.md) (execution evidence map).
