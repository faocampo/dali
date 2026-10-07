# Independent Phase 5 checkpoints — reconciliation

The user designated the isolated continuation and requested preservation of the original checkpoint. The delivery remains fixed at `c072cb9`; its product and tests are identical to the completed automated 05-04 cut `069c1ca`. New recovery work stays on `codex/recovery-wip-20261006` and is not published or served by the trial instance.

## Preserved histories

- Shared starting point: `121b43af4882d194a411a8818da342f3c13997c5`.
- Original checkpoint: `8145bbe24b75c191efeab333cbfdef4872e25298` preserves presence changes and the unresolved pan check; `658eb2866022b4ec45c36739f4650ff40450f5bb` implements a personal-history tracer; `55c465cb09ed443021e8e524b4cb02928c60ec45` expands its tests. `184b73178020c59a0e2dbdf51edec41fd2a23325` records execution ownership. A separate local reference retains this complete history.
- Isolated implementation: the stabilization and completed 05-04 behavior described in [05-04-SUMMARY](05-04-SUMMARY.md), followed by the verified recovery tracer `c952a2143822252876dbc3dd448dc23a1cb327e0` and unfinished 05-05-02 work.

## Behavioral comparison

| Area | Original checkpoint | Isolated continuation |
|---|---|---|
| Presence | Scale adjustment retained; native pan projection remains unresolved | Retains the scale adjustment, measures the actual canvas origin, and verifies pan/zoom in the integrated matrix |
| Capture | Complete text-session tracer | Complete text sessions and native gestures/operations; native UndoManager lifecycle retained |
| Provenance | Property-change rows and a client baseline/path preflight | Server-acknowledged action identity and native update event paths, including same-value ABA |
| Commit boundary | Reservation-bound intent and inverse path recheck | Action identity bound to a fresh reservation and actual inverse/provenance checked transactionally |
| History lifetime | Clean reconnect still pending | Same-tab eligible history preserved across authorized clean reconnect; reload resets it |
| Evidence | 6 Chromium, 4 client, 50 targeted server checks and static checks; no integrated plan completion | Revision-scoped automated 05-04 gates recorded independently; no inherited pass is relabeled as an isolated pass |

Both variants use migration **11**, with different tables: `document_property_changes` versus `document_action_properties`. Their storage is not interchangeable. No database, migration or partial implementation is imported across variants. Any future data conversion requires a separately validated migration; the synthetic trial starts from independent storage.

## Integration decision

Retain the isolated implementation and its completed automated 05-04 gate. Do not cherry-pick the overlapping tracer over it. Preserve original failures, partial results and subsequent selection/focus test corrections as evidence of that independent checkpoint. Its incomplete gate does not invalidate the isolated completed gate, and its passes do not expand the isolated gate.

The original 360px redo-feedback scenario and explicit continuation toward an older eligible history step remain useful additional coverage candidates. They have not been run here merely because their source was compared. Integration of any such case must establish actual native behavior on this implementation before claiming a pass.

Continue 05-05 under the approved plan. The live trial remains fixed, the user’s prior Phase 4 exceptions remain accepted within their original scope, and Phase 5/internal-release acceptance remains open.
