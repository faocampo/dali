# Phase 4 — Coverage and Source Audit

No external API integration: this phase extends existing Dali browser/server persistence and packages it for Kubernetes; it adds no new third-party application API or SDK integration. The compiled API detector examined the plan set and returned detected:false. Existing OIDC uses its approved interface; actual-provider acceptance remains backlog999.4.

This is a planning coverage record, not execution evidence. Sources: [CONTEXT](04-CONTEXT.md) (15locked decisions), [RESEARCH](04-RESEARCH.md) (durability and operations mechanisms), [UI-SPEC](04-UI-SPEC.md) (36confirmed predicates), [REQUIREMENTS](../../REQUIREMENTS.md) (approved acceptance) and [ROADMAP](../../ROADMAP.md) (phase outcome and allocation).

## Wave ownership

| Wave | Plans | Outcome |
|---|---|---|
| 1 | 04-01 | Prove acknowledged board and image survival through process restart |
| 2 | 04-02 | Fence restored server state across document, image and metadata requests |
| 3 | 04-03, 04-10 | Capture reconstructable work before network synchronization; Publish verified complete SQLite backups to an independent destination |
| 4 | 04-04, 04-11 | Recover authorized pending work and pause unsafe mutations; Schedule retained backups and enforce the one-hour recovery bound |
| 5 | 04-05, 04-12, 04-13 | Make save state follow current document and image acknowledgments; Restore an operator-selected backup into a fenced fresh target; Build and run a production-only container boundary |
| 6 | 04-06, 04-09, 04-14 | Download a complete authorized archive of pending recovery work; Show account-isolated pending work on authorized library cards; Deploy one durable writer with generic Kubernetes configuration |
| 7 | 04-07 | Expose actionable title-adjacent save details and image failures |
| 8 | 04-08 | Preserve title intent and warn before leaving unresolved saving |
| 9 | 04-15 | Measure independent storage-loss recovery and operational targets; prove backup-fence browser recovery after coordinator/status fixtures exist |
| 10 | 04-16 | Complete cross-browser recovery and source-mapped acceptance |

Each task modifies at most5files; every plan has2–3tasks. Same-wave file lists are disjoint. A dependency includes prior shared-file owners, not merely functional prerequisites. Browser/cluster acceptance shares resource locks even across otherwise independent plans. The first real restart tracer must pass before expansion.

Revision1 preserves16plans and10waves, with36tasks after separating the server and browser proofs. The server/grant write-admission scope stays in04-11-03 (wave4); the browser proof is04-15-03 (wave9), with explicit04-04 and04-05 dependencies. Plan04-11 retains3tasks and04-15 now has3tasks; their calibrated/raw projections are26000 and32000 tokens respectively, with the existing factor1/low-confidence calibration. The seven research questions map to selected tasks in RESEARCH's Planner Resolutions; its four external prerequisite gates remain pending execution evidence.

## Four-source audit

| SOURCE | ID | Feature or requirement | Plan | Status |
|---|---|---|---|---|
| GOAL | Phase4 | Saved boards/images survive browser/service interruptions; operators deploy and recover service | 04-01 through04-16 | COVERED |
| REQ | SAVE-01 | Cold authenticated reopen after restart | 04-01, 04-02, 04-03, 04-04, 04-06, 04-12, 04-15, 04-16 | COVERED |
| REQ | SAVE-02 | Distinguish saved/pending/failure | 04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-11, 04-12, 04-15, 04-16 | COVERED |
| REQ | OPS-01 | Documented operator infrastructure deployment | 04-11, 04-13, 04-14, 04-15, 04-16 | COVERED |
| REQ | OPS-02 | Backup/restore and verified intact reopen | 04-02, 04-10, 04-11, 04-12, 04-14, 04-15, 04-16 | COVERED |
| CONTEXT | D-01 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-05, 04-07 | COVERED |
| CONTEXT | D-02 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-05, 04-06, 04-07 | COVERED |
| CONTEXT | D-03 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-05, 04-06, 04-07 | COVERED |
| CONTEXT | D-04 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-08 | COVERED |
| CONTEXT | D-05 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-03, 04-04, 04-08 | COVERED |
| CONTEXT | D-06 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-02, 04-03, 04-04 | COVERED |
| CONTEXT | D-07 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-04, 04-06, 04-08 | COVERED |
| CONTEXT | D-08 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-09 | COVERED |
| CONTEXT | D-09 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-13, 04-14 | COVERED |
| CONTEXT | D-10 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-11, 04-14, 04-15 | COVERED |
| CONTEXT | D-11 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-13, 04-14 | COVERED |
| CONTEXT | D-12 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-10, 04-11, 04-12, 04-15 | COVERED |
| CONTEXT | D-13 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-10, 04-11, 04-15 | COVERED |
| CONTEXT | D-14 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-12, 04-15 | COVERED |
| CONTEXT | D-15 | Locked text from approved CONTEXT; exact ID cited in truths/actions | 04-02, 04-10, 04-11, 04-12, 04-15 | COVERED |
| RESEARCH | R-01 | WAL/FULL/readback and persistent companions — Real process restart and cold browser; incompatible persistence rejects startup. | 04-01 | COVERED |
| RESEARCH | R-02 | Document/image atomicity and image-before-reference order — Transactional binding/reference validation retained; complete ack only. | 04-01, 04-02, 04-03, 04-04 | COVERED |
| RESEARCH | R-03 | Immediate Yjs capture outside network peer lifecycle — Independent local listeners and reconstruction baseline before mutations. | 04-03 | COVERED |
| RESEARCH | R-04 | Strict IndexedDB completion; memory retention; durable local ordering — Native abort/quota/blocked-upgrade tests; preservation truth follows tx completion. | 04-03, 04-04 | COVERED |
| RESEARCH | R-05 | Legacy IDB migration; malformed/epoch-less quarantine — Keep v1 records intact; schema-versioned adapter; no automatic epoch adoption. | 04-03, 04-04 | COVERED |
| RESEARCH | R-06 | Complete baseline and retained available image bytes — Checkpoint includes root/content/title/assets; missing required bytes errors. | 04-03, 04-06 | COVERED |
| RESEARCH | R-07 | Immutable record IDs/exact ack/atomic compaction/two tabs — Older acks retain new and other-tab edits; retry coalescing. | 04-03, 04-05 | COVERED |
| RESEARCH | R-08 | Auth/outage/storage-pause distinctions; absolute expiry — Current session then descriptor before reads/replay; known expiry pauses. | 04-04, 04-05 | COVERED |
| RESEARCH | R-09 | Retry delays1/2/4/8/16/30s;jitter;stall15s;abort30s — One drain; coordinate native peer; known error stays while retrying. | 04-04, 04-05 | COVERED |
| RESEARCH | R-10 | Random persistent epoch; ordinary restart stable; restored rotation — Authorized descriptors/ack epoch plus commit-time rejection. | 04-02, 04-12 | COVERED |
| RESEARCH | R-11 | Scope epoch on image/document/metadata/import/grant paths — Complete route inventory; no replay of grants/delete/duplicate as Yjs. | 04-02, 04-11 | COVERED |
| RESEARCH | R-12 | Outage title intent through operation receipts — Latest scoped title and base revision preserved; conflict does not overwrite. | 04-08 | COVERED |
| RESEARCH | R-13 | Recovery export authority distinct from mutation pause — Local-only unexpired authorized scope; cold/server reads require fresh authorization. | 04-04, 04-06 | COVERED |
| RESEARCH | R-14 | Snapshot archive; semantic/hash import verification — Fixed activation snapshot, all references; native Import creates private board. | 04-06, 04-16 | COVERED |
| RESEARCH | R-15 | Native unload limits and safe in-app Leave — Real browser warning checks plus continuous capture. | 04-08, 04-16 | COVERED |
| RESEARCH | R-16 | All36 approved UI truths and shared responsive/focus matrix — Exact surface/category lift and coverage table below. | 04-04, 04-06, 04-07, 04-08, 04-09, 04-16 | COVERED |
| RESEARCH | R-17 | Node24 pinned OCI digest; native SQLite Linux proof — Registry/native binding preflight; actual image build/run. | 04-13 | COVERED |
| RESEARCH | R-18 | Production-only compile; same-pod loopback static proxy — Synthetic provider excluded; secure HTTPS/proxy tests. | 04-13 | COVERED |
| RESEARCH | R-19 | Kustomize one replica/Recreate/RWOP or explicit fencing — No horizontal writers; independent failure domain requires proof. | 04-14, 04-15 | COVERED |
| RESEARCH | R-20 | Ingress/TLS/external secret/config/resource/security context — Generic interfaces; operator configuration private; real synthetic HTTPS gate. | 04-13, 04-14, 04-15 | COVERED |
| RESEARCH | R-21 | Startup/readiness/liveness;45sdrain/60sgrace — Provider/backup outage doesn't create liveness restarts. | 04-13, 04-15 | COVERED |
| RESEARCH | R-22 | Online verified SQLite snapshot;manifest/digest/fsync/atomic publish — Full data graph validates; completion last; partial never selectable. | 04-10 | COVERED |
| RESEARCH | R-23 | 15minute automatic startup/due scheduling;single job — Clock/scheduler duplicate,missed timer,restart tests. | 04-11 | COVERED |
| RESEARCH | R-24 | 45minute alert/60minute transactional write fence — Conservative independent recovery-point age; startup baseline mandatory; browser pending-to-Saved proof follows coordinator/status fixtures. | 04-11-01/02/03, 04-15-03 | COVERED |
| RESEARCH | R-25 | 30day complete retention;last-good preservation;capacity — 31day boundary;measured size,cadence and25%headroom. | 04-11, 04-15 | COVERED |
| RESEARCH | R-26 | Fresh-target operator restore;schema compatibility;old WAL fencing — Explicit selected digest;refuse nonempty target;production destructive checkpoint. | 04-12, 04-15 | COVERED |
| RESEARCH | R-27 | Restored session invalidation;post-point access reconciliation — Closed ingress until integrity and Owner/Editor/Viewer/denied cold checks. | 04-12, 04-15 | COVERED |
| RESEARCH | R-28 | Separate24hour maintenance/RTO;1hourRPO measurements — Actual clock and acknowledged canaries; simulation scope remains explicit. | 04-15 | COVERED |
| RESEARCH | R-29 | 50boards/3identities/128MiBimages/complex native board dataset — Seeded exact counts/dimensions/hashes; limits verified separately. | 04-15 | COVERED |
| RESEARCH | R-30 | Environment: unavailable daemon/cluster/registry — Real prerequisite gate; no runtime claim from rendering or local tests. | 04-13, 04-14, 04-15 | COVERED |
| RESEARCH | R-31 | A1 independent storage semantics;A2 no external writer — Private operator confirmation and actual independent storage-loss drill. | 04-14, 04-15, 04-16 | COVERED |
| RESEARCH | R-32 | Existing pinned dependencies;SUS from unavailable lookup — No upgrade; repeat metadata/source gate before clean install; substantive concern blocks. | 04-13 | COVERED |
| RESEARCH | R-33 | Public privacy and synthetic evidence — No private host/config/identity artifacts; package/README concurrent work preserved. | 04-01 through04-16 | COVERED |
| RESEARCH | R-34 | ASVS1/high threats — Each plan has scoped trust boundary,STRIDE register and mitigation/probe. | 04-01 through04-16 | COVERED |
| RESEARCH | R-35 | Prior behavior: role/Owner retention/archive import/deferrals — Current PROJECT decisions supersede old optional-copy UI; backlog999.3/999.4 separate. | 04-02, 04-04, 04-06, 04-09, 04-12, 04-16 | COVERED |

Exclusions with source authority: Phase5 simultaneous multi-user convergence/presence/personal undo/active revocation; backlog999.4 real-provider acceptance; backlog999.3 spoken assistive-technology acceptance; existing deferred MCP/Plane and excluded ClickUp. Same-account concurrent-tab journal integrity remains Phase4.

## Exact36 UI predicate mapping

Every acceptance truth below is lifted verbatim into the named plan's must_haves.truths with E#/category identity. The shared matrix runs in04-16-01 and does not replace earlier slice assertions.

| Surface/category | Exact accepted truth | Owning plan/task | Final oracle |
|---|---|---|---|
| E1/loading | Show Saving or pending/recovery progress beside the title; retain the last acknowledged server time. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E1 loading |
| E1/error | Apply defined status precedence and open details only on activation; never report Saved until current content and required images are acknowledged. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E1 error |
| E1/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E1 overflow |
| E1/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E1 long-text |
| E2/empty | Omit an empty image list; healthy details show the saved message and acknowledged time. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 empty |
| E2/loading | Update individual upload/retry rows in place without stealing focus or removing access to recovery download. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 loading |
| E2/error | Identify each failed image; keep its error until that required image is acknowledged or confirmed obsolete. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 error |
| E2/populated | Show stable image labels, available thumbnails, row status and permitted Select image actions. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 populated |
| E2/partial | Use a neutral placeholder for missing previews; mixed success and failure retains unresolved rows. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 partial |
| E2/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 overflow |
| E2/zero-one-many | Omit zero-image sections, use singular/plural copy and vertically scroll the specified 50-row case. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 zero-one-many |
| E2/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-07-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E2 long-text |
| E3/empty | A valid board with no images exports without an image section; a referenced but unavailable image follows the missing-image error contract. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 empty |
| E3/loading | Show Preparing recovery copy and suppress duplicate preparation while retaining the board and pending data. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 loading |
| E3/error | Preparation or missing-image failure retains journal and in-memory content, exposes retry and never hands off a silently incomplete success archive. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 error |
| E3/populated | Hand off a complete authorized snapshot archive compatible with Import; the ready message does not clear pending work or claim a disk save. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 populated |
| E3/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 overflow |
| E3/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-06-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E3 long-text |
| E4/empty | A valid empty board remains a valid canvas; inaccessible or unavailable board data uses the load/denied contract rather than a fabricated empty board. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 empty |
| E4/loading | Check current account and permission before recovery, then show recovery progress until server acknowledgment. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 loading |
| E4/error | Use distinct load, permission, corrupt-journal and restoration-mismatch states; retain isolated pending data and gate content/actions by current authority. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 error |
| E4/populated | Display the authorized board with its images; restore a still-valid editing context without overriding a subsequent focus move. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 populated |
| E4/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 overflow |
| E4/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-04-01/02/03 | tests/recovery-ui-matrix.spec.ts — @04-ui-E4 long-text |
| E5/loading | After explicit Leave, suppress duplicate navigation while the requested transition completes and focus the destination heading. | 04-08-02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E5 loading |
| E5/error | Unconfirmed local preservation adds the defined loss warning; Stay retains the current board and Leave remains an explicit informed choice. | 04-08-02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E5 error |
| E5/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-08-02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E5 overflow |
| E5/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-08-02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E5 long-text |
| E6/empty | Keep the existing empty-library view; zero pending records adds no marker and does not fabricate cards. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 empty |
| E6/loading | Load authorized cards independently and expose Checking recovery status while journal inspection is pending. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 loading |
| E6/error | Inspection failure shows Recovery status unavailable with Refresh boards retry; access-list failure does not reveal cached private cards. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 error |
| E6/populated | Place the matching account/browser pending marker below role/access metadata without changing server edited time, grid ordering or card actions. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 populated |
| E6/partial | A missing preview uses the existing card fallback; marker visibility depends on authorized metadata and journal evidence, not preview success. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 partial |
| E6/overflow | Use the Responsive Layout contract: viewport-clamped surfaces, vertical scrolling, reachable controls and no horizontal page overflow. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 overflow |
| E6/zero-one-many | Preserve the current zero/one/many-card layout and test 50 marked cards; clear each marker only on acknowledgment of its matching pending work. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 zero-one-many |
| E6/long-text | Wrap explanatory text and image names while preserving full accessible labels; test the specified long-title/name fixtures and 320px layout. | 04-09-01/02 | tests/recovery-ui-matrix.spec.ts — @04-ui-E6 long-text |

## Spec-less edge coverage

| Requirement/category | State | Authored acceptance or flagged assumption | Plan |
|---|---|---|---|
| SAVE-01/idempotency | resolved / explicit | Repeating uncertain document/image submissions leaves one semantic result and preserves acknowledged work | 04-01 |
| SAVE-01/concurrency | resolved / explicit | Before/after-commit/after-response process kills preserve every acknowledged save with transaction-time validation | 04-01 |
| SAVE-02/idempotency | resolved / explicit | Exact immutable ID acknowledgments retain newer edits and unrelated failed images | 04-03 |
| SAVE-02/concurrency | resolved / explicit | Two tabs, blocked upgrade, compaction and stale callbacks preserve independent records | 04-03 |
| OPS-01/unclassified | unresolved / flagged assumption | Environment/topology applicability requires explicit operator prerequisite review; detector classification remains unresolved | 04-13 |
| OPS-02/unclassified | unresolved / flagged assumption | Independent failure domain,actual timing and operator recovery envelope require explicit review | 04-15 |

No-silent-drop equality:6surfaced=4explicit truths+2flagged assumptions. No auto-dismissal or invented backstop resolution.

## Prohibition recall and projection

The two-stage requirement recall retained7bespoke intent constraints; routine correctness is covered by tests and canon security items route to secure-phase/STRIDE. Shared projectProhibitions projected exactly7descriptor-less rows. They remain flagged-unverified judgment items, with no invented check_kind/check_target/check_rule/fixture. No automatic passing disposition is claimed.

| Requirement | Kept intent | Owning plan | Disposition |
|---|---|---|---|
| SAVE-01 | SAVE-01: MUST NOT silently apply browser pending work over the operator-selected restored server state. | 04-01 | flagged-unverified judgment |
| SAVE-01 | SAVE-01: MUST NOT present a browser-local or cached reopen as proof that acknowledged work survived server restart. | 04-01 | flagged-unverified judgment |
| SAVE-02 | SAVE-02: MUST NOT claim preserved or saved work from request dispatch, incomplete local transactions, export handoff, or an unrelated image success. | 04-05 | flagged-unverified judgment |
| SAVE-02 | SAVE-02: MUST NOT clear pending work merely because the user downloads recovery, leaves, or opens the restored board. | 04-05 | flagged-unverified judgment |
| OPS-01 | OPS-01: MUST NOT place real operator deployment settings or private operational evidence into public repository artifacts or history. | 04-13 | flagged-unverified judgment |
| OPS-02 | OPS-02: MUST NOT automatically select a restore or reopen traffic before the operator verifies content and access. | 04-12 | flagged-unverified judgment |
| OPS-02 | OPS-02: MUST NOT claim RPO or RTO from scheduling, static manifests, local staging or simulated clocks alone. | 04-12 | flagged-unverified judgment |

## Hook decisions and discovery

- API detector: detected:false on real plan scope; no external integration matrix invented.
- Assumption-delta: detected another browser; no-change. Account/server board identity remains primary; browser journal is scoped recovery evidence. Recorded in04-01.
- Schema-gate: no Payload/Prisma/Drizzle/Supabase/TypeORM pattern applies. Native SQLite additive migration8 and IndexedDBversion2 remain actual schema obligations with file-backed/native upgrade tests, not an invented ORM push.
- Security: ASVS1; high severity blocks acceptance; every plan has a threat model. Package installation is existing lockfile-only with source/provenance recheck and actual runner prerequisites.
- Discovery uses current phase research and pattern extraction with cited primary docs; no new dependency selection. Existing code and exact prior commands ground plans.
- Reversibility: versioned additive adapters and fresh-target restore retain source data. Execution proves synthetic fresh targets only; destructive real schema/storage replacement has a runbook checkpoint:decision before operator action. D-15 operator initiation is already locked.
- Estimate calibration: factor1,0samples,confidence low; estimates are projections, not observed model usage.
- MVP framing preserves approved members/operators outcome and vertical slices. No new product story scope was added.

All sourced feature rows are planned. Environment confirmations and descriptor-less judgment predicates remain explicit acceptance obligations rather than missing implementation scope.
