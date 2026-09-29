# Proposed next steps — awaiting confirmation

Phase 4 was validated by the user on 2026-09-29. The remaining WebKit Save Details fix is backlog 999.7. Independent storage/capacity (999.6), actual-provider acceptance (999.4), and spoken assistive technology (999.3) retain their prior deferrals.

## Next: Phase 5 — Real-Time Collaborative Editing

Approved requirements: CAN-03, COL-01, COL-02, COL-03, COL-04 and MIND-05. The roadmap requires 20 simultaneous authenticated participants, with no product-enforced admission cap.

1. **Discuss and agree on the collaboration contract.** Define visible presence, connection/reconnection states, concurrent editing behavior, personal undo, and what happens to queued edits after permission changes. Agree on the representative 20-participant workload and measurable latency, convergence and recovery thresholds.
2. **Research and specify the implementation and UI.** Inspect existing document synchronization and authorization boundaries. Define synchronization transport, presence lifetime, durable acknowledgment, reconnect behavior, and access revocation. Produce the Phase 5 context, research and UI contract with synthetic test scenarios.
3. **Create and check an executable plan.** Sequence work as a two-participant end-to-end editing slice, presence, personal undo, reconnect/revocation, and concurrent mind-map editing. Validate the plan against every approved Phase 5 requirement.
4. **Implement and validate the approved plan.** Test simultaneous edits, personal undo that preserves others' edits, disconnect/reconnect, live revocation and queued writes, concurrent mind maps, cold reopening, and 20-participant convergence. Revisit backlog 999.7 only if explicitly promoted or shown to block a new Phase 5 requirement; document that decision.
5. **Present acceptance evidence.** Report actual test outcomes and outstanding limitations before closing Phase 5.

## Confirmation requested

Confirm starting **Phase 5 discussion** (`$gsd-discuss-phase 5`). This proposal is not a Phase 5 context, technical design, implementation plan, or approval of unresolved product decisions. Execution has not started.

Sources: [ROADMAP.md](ROADMAP.md) (approved Phase 5 sequence and success criteria), [REQUIREMENTS.md](REQUIREMENTS.md) (collaboration acceptance requirements), [Phase 4 verification](phases/04-durable-boards-and-recovery/04-VERIFICATION.md) (accepted scope and preserved failed-test evidence).
