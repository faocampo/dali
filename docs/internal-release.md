# Controlled internal release checklist and runbook

Status: **not ready for a collaborative internal pilot**. This document separates the approved v1 roadmap from the minimum evidence needed to expose a bounded internal capability. It does not approve a smaller release, enable collaboration generally, or authorize deployment.

## Capability and evidence inventory

The authoritative sequence remains [.planning/ROADMAP.md](../.planning/ROADMAP.md). Phases 1–4 have recorded acceptance with the limits below. Acceptance history is not a claim that every historical test was rerun on the present revision.

| Phase | Frontend | Backend | Recorded disposition |
|---|---|---|---|
| 1. Editable Canvas and Image Portability | Native editing, arrangement, imports and exports | Local editor/storage foundation | Accepted; native Finder/system-clipboard steps were not individually evidenced |
| 2. Daily Mind Maps | Hierarchy, keyboard editing, collapse, layout and styling | Local persistence model | Accepted; collaborative hierarchy belongs to 05-08 |
| 3. Okta and Board Access | Sign-in, library, owner/editor/viewer controls | Generic OIDC, sessions and board/document/image authorization | Accepted with actual-provider and spoken assistive-technology follow-ups |
| 4. Durable Boards and Recovery | Acknowledged save status, pending-work preservation and recovery | Durable SQLite, epochs, receipts, backup/restore and deployment package | Accepted with independent storage/capacity and WebKit exception |
| 5. Real-Time Collaborative Editing | Native reservations and participant UI implemented; personal history verified; recovery/access-transition acceptance incomplete | Live transport, fencing and presence implemented; history provenance implemented; recovery/access/load obligations incomplete | In progress; opt-in boundary retained |

Existing single-user undo or generic recovery must not be presented as completion of personal collaborative history or divergence-aware recovery. A roster of 20 or more accounts is not evidence of 20 simultaneous native editors.

### Phase 5 delivery boundaries

| Plan | Delivered foundation | Remaining acceptance/work |
|---|---|---|
| 05-01 live tracer | Authenticated live feed, native independent edits, idempotent commit receipts, Viewer projection and durable restart tests | Whole-phase load and interruption matrix remains 05-09 |
| 05-02 reservations | Native action admission, complete object dependencies, cancellation and release; sequential-format repair in this stabilization slice | Deterministic and combined gates pass; remote issue #1 remains unchanged for maintainer disposition |
| 05-03 presence | Server-derived identities/roles, account aggregation, editor cursor/selection overlays, publication retry and explicit original-session disconnect | Automated plan gate passes; native browser-chrome zoom and phase-level human UX acceptance remain |
| 05-04 personal history | Complete text/operation capture, server provenance, conflict-safe inverse checks and clean reconnect verified; final 98/98 Chromium, 26/26 cross-browser history, 265 client and unchanged 375 server tests pass | Automated plan complete; pending-work recovery remains 05-05 and whole-phase/human acceptance remains open; [revision-scoped evidence](../.planning/phases/05-real-time-collaborative-editing/05-04-SUMMARY.md) retains failed matrix and targeted corrections |
| 05-05 divergent recovery | Isolated per-tab candidates, exact document/title receipts, fresh reservations with transactional version checks, restored-write consent, recovered personal history and new local outage gestures implemented; [execution evidence](../.planning/phases/05-real-time-collaborative-editing/05-05-EXECUTION.md) | Automated plan complete at `ab0b8a7`: 286 client, 388 server, both typechecks, 48 Chromium and 60 Firefox/WebKit pass; [revision-scoped summary](../.planning/phases/05-real-time-collaborative-editing/05-05-SUMMARY.md). Private-copy/latest flow remains 05-06; Phase 5 and pilot acceptance stay open |
| 05-06 private recovery copy | Whole native private copy, original image pixels, identity remapping and reload receipts pass all three engines; latest/download/cancel and atomic checkpoint handoff implemented with initial Chromium failure-path evidence | In progress: additional authority/other-tab/UI coverage and final combined/cross-browser gates; [execution evidence](../.planning/phases/05-real-time-collaborative-editing/05-06-EXECUTION.md). No plan or pilot acceptance yet |
| 05-07 active access transitions | Direct API capability checks and live reauthorization exist | Verified downgrade/revocation/restoration UX, pending-work isolation and queued/held request matrix |
| 05-08 collaborative mind maps | Single-user native hierarchy and layout exist | Complete structural reservation/validation, concurrent branch editing and durable hierarchy acceptance |
| 05-09 acceptance | Slice-level synthetic browser and server fixtures exist | Twenty distinct simultaneous native editors, measured convergence, browser/restart matrix, full regression and explicit human phase acceptance |

The remaining rows are engineering work, not requests for additional credentials. They must proceed in the approved dependency order. External operator access is needed only for the separately identified real-environment gates.

## Remaining approved v1 capabilities

| Phase | Objective | Relationship to a bounded canvas/coediting pilot |
|---|---|---|
| 6. Follow Me | Follow a presenter and return to independent navigation | Needed if presenter-following is promised; not intrinsically needed to protect ordinary edits |
| 7. Entity Comments | Persist discussion on the same entity across movement and reopen | Needed if entity comments are promised |
| 8. Shared Timer | Consistent timer across participants, refresh and late joins | Needed if facilitated timed exercises are promised |
| 9. Voting | Eligible cards, individual allowances, concurrency-safe votes and result reveal | Needed if voting sessions are promised |
| 10. Reusable Product and Roadmap Templates | Product exercises and ordinary-object roadmaps with independently editable copies | Needed if the approved reusable template workflows are promised |
| 11. Editable Mockups | Editable screen compositions alongside references and notes | Needed if mockup workflows are promised |
| 12. Technical Diagram Palettes | Product flows, sequence diagrams, swimlanes and C4 compositions with stable connections | Needed if the expanded technical palette is promised |
| 13. Manual Gantt Widget | Manual tasks/dates, navigable colored timeline and durable widget/template data | Needed if Gantt workflows are promised |

These phases remain required for the approved complete v1 and are not removed or newly deferred. Their plans are still TBD. A narrower pilot would need an explicit capability statement and acceptance of its exclusions; the table explains dependencies rather than granting that acceptance. Research obligations in the roadmap still govern facilitator permissions, entity lifecycle, voting rules, bounded palette inventories and date semantics.

## Pilot gates

- [ ] Complete the nine sequential Phase 5 plans and their native browser/security acceptance: personal undo/redo, divergent recovery without automatic merge, private-copy/latest-version choices, active downgrade/revocation and permission restoration, concurrent mind-map integrity, and 20 distinct simultaneous editors with durable convergence.
- [ ] Verify the current source in the intended browser matrix, with zero required skips, retries or unexpected runtime errors. Preserve any failed evidence separately from accepted exceptions.
- [ ] Demonstrate the exact participant path: authorized sign-in → board creation/sharing → native editing/images/mind map → second editor and Viewer → formatting/undo → disconnect/reconnect → permission change → acknowledged save → clean reopen and service restart.
- [ ] Record the selected internal capability boundary, browser support, cohort, data classification, operator and stop criteria. Do not claim all v1 features for a narrower pilot.
- [ ] For real internal identities, complete operator-controlled OIDC acceptance from [access-acceptance.md](access-acceptance.md). Synthetic identity tests do not satisfy this gate.
- [ ] For durable internal work, verify the actual storage failure domain, capacity, retention and backup/restore access. Local filesystem drills do not satisfy the independent-storage gate.
- [ ] Validate the actual release images and deployment configuration before opening shared access, using [deployment.md](deployment.md) and [operations.md](operations.md). Historical container/cluster evidence has its original revision scope.
- [ ] Complete the relevant human UI acceptance, including native browser zoom and native image picker/clipboard behavior; retain the separate assistive-technology follow-up without inventing a pass.

Synthetic local acceptance can proceed without real-provider or infrastructure credentials. It establishes development evidence only. No new provider, secret, permission or paid service is required to run those fixtures.

## Local verification procedure

Use an isolated checkout, the committed lockfile, installed pinned dependencies, disposable synthetic identity fixtures and their owned temporary databases. Preserve any incoming local changes. Run only one browser/build gate at a time per checkout. If another checkout is using the default loopback fixtures, set an unused integer `DALI_TEST_PORT_OFFSET` for the browser command; for example, `2000` moves the configured 5493–5499 ports to 7493–7499. The synthetic provider callbacks and application proxies move together. This changes test fixtures only. Do not stop another checkout's services to free its ports.

```sh
npm run typecheck
npm run typecheck:server
npm test
npm run test:server -- --maxWorkers=1
npm exec playwright test -- tests/collaboration.spec.ts tests/collaboration-reservations.spec.ts tests/collaboration-formatting-race.spec.ts tests/collaboration-pointer-race.spec.ts tests/collaboration-presence.spec.ts tests/collaboration-history.spec.ts tests/collaboration-history-reconnect.spec.ts tests/collaboration-history-reservation.spec.ts tests/collaboration-recovery.spec.ts tests/collaboration-recovery-boundaries.spec.ts tests/collaboration-recovery-restore.spec.ts tests/collaboration-offline-editing.spec.ts tests/canvas-arrangement.spec.ts tests/image-visual-edits.spec.ts tests/ui-refinements.spec.ts tests/restored-viewer.spec.ts --project=prod
```

Example with isolated ports: `DALI_TEST_PORT_OFFSET=2000 npm exec playwright test -- tests/collaboration-history.spec.ts --project=prod`. Keep the same offset for every fixture launched by that command.

Repeat the applicable native gates with `--project=prod-firefox` and `--project=prod-webkit`. The current suites above cover delivered slices; they do not replace the remaining Phase 5 recovery, access, mind-map and load suites. Check the selected-test inventory before interpreting success. Record command, source revision, counts, skips/retries and failures. Keep raw machine paths and private operator evidence outside publishable history.

## Local review sessions

Pin a review session to its exact source revision and keep ongoing development in a separate checkout. If a person may retain work between restarts, use a dedicated on-disk SQLite database and verify reopening the same boards after a controlled restart. In-memory acceptance fixtures intentionally lose their data when the owning process stops; a fresh synthetic seed is a new session, not a restoration. Preserve available data and establish the intended recovery source before restarting an interrupted manual review. Do not substitute another checkout's database when its migrations differ.

## Launch, observation and rollback

1. Keep shared ingress closed until authorization, current-source browser acceptance and restored-data verification are complete. Keep the existing collaboration opt-in boundary until whole-phase acceptance authorizes expansion.
2. Produce an acknowledged backup and independently verify its manifest, documents and original images using the existing operations procedure. Record the last successful backup and source revision privately.
3. Admit only the agreed cohort to the agreed capability. Observe save failures, reservation failures, connection interruptions, role transitions and backup freshness. Do not interpret a healthy connection as saved content.
4. Stop admissions on unauthorized access, lost acknowledged work, unexplained divergence, failed restore, or an unmet backup freshness bound. Preserve pending work and diagnostic evidence before intervention.
5. Fence the old writer before replacing or restoring storage. Use the documented selected-backup restore and fresh epoch procedure; verify grants after the restore point before reopening. Never solve a data/schema issue with an unverified in-place downgrade.
6. Re-run the failed acceptance path on the corrected revision before readmitting users. Preserve the original failure and the corrective evidence.

## Retained limits

- Actual-provider acceptance: backlog 999.4, not executed here.
- Independent storage and capacity: backlog 999.6, not executed here.
- Spoken assistive technology: backlog 999.3, not executed here.
- Historical WebKit Save Details failure: backlog 999.7; the accepted historical full run was 2,051/2,052, not an all-pass result.
- Sequential typography: backlog 999.8 / issue #1. Its deterministic reproduction and current repair evidence are recorded in the phase execution report; do not infer resolution from an unrelated passing run.
- Native Finder PNG/JPEG, system clipboard and actual browser-chrome zoom remain distinct from automated file-input, clipboard API, CSS viewport or page-scale checks.
- Cold Viewer-first hydration has historical corrective evidence; use the current `restored-viewer.spec.ts` result when assessing the present revision.
- No shared deployment, publication, remote merge or real organizational data is part of this local verification.
