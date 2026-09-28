# Local Kubernetes Validation

Date: 2026-09-27
Scope: explicitly authorized disposable local Kubernetes setup and tests.

## Environment

- kind 0.32.0; Kubernetes 1.36.1; Calico 3.32.1 with enforced NetworkPolicy.
- Production application and web container builds, synthetic signed OIDC/PKCE and private-CA HTTPS.
- One writer with Recreate deployment strategy, explicit scale-to-zero and old-pod termination before replacement or offline restore.
- Separate ReadWriteOnce live and backup PV directories in the same container host backing volume.
- The local HTTPS fixture supplies routing and a maintenance gate. Generic production Ingress-controller behavior remains outside this test.
- Fixture configuration, keys, kubeconfig, runtime state, reports and screenshots remain outside the public repository.

## Verified checks

| Check | Result |
|---|---|
| Current and previous compatible container image smoke tests | Pass |
| Storage locking, SQLite WAL/FULL, fsync, rename, restricted directory permissions | Pass |
| Backup marker survives selected synthetic live-directory loss | Pass |
| Allowed OIDC traffic, denied unapproved egress and untrusted ingress | Pass |
| HTTPS rejects an unexpected Host header | Pass, HTTP 421 |
| Signed login, secure cookie, persisted documents/images after a replacement pod | Pass |
| Local scope validation and production manifest checks | 16 self-tests pass; manifest check passes |
| Browser backup freshness and replay | Pass in Chromium, Firefox and WebKit |
| Application and server TypeScript checks | Pass |

The browser freshness test uses the real scheduler, backup publication and HTTP write rejection with a test-only clock advance. It covers the 45-minute alert, 60-minute cutoff and a further simulated 24-hour maintenance interval. Notes and images remain locally pending, resumed coverage rechecks access, and an older acknowledgment cannot mark newer edits Saved. Final acknowledgment clears the journal; reload retains the content.

## Recovery drill

The drill seeds 50 representative boards and 50 generated PNGs containing 143,329,267 image bytes. The largest board includes 1,000 ordinary objects and 100 mind-map nodes. It records host-held hashes and verifies authorized cold document/image reads across identities, along with denied reads and role-specific writes.

The test covers fenced restart, prior-compatible-image rollback and return, online backup with acknowledged canaries, explicit manifest selection, deletion of only the selected original synthetic SQLite files, offline fresh-target restore, session invalidation, epoch changes, reconciliation of a post-backup revocation and renewed backup coverage.

The local runtime drill passed, including all cold API hashes and roles. The native Chromium follow-up found a read-only hydration failure, recorded separately below.

| Measurement | Observed |
|---|---:|
| Fenced restart | 16.882 seconds |
| Compatible rollback and return | 32.214 seconds |
| Backup publication | 9.058 seconds |
| Incident through verified usable API service | 116.952 seconds |
| Selected recovery-point age | 9.050 seconds |
| Acknowledgment loss gap | 6.933 seconds |
| Timestamped canaries | 21 |
| Selected backup bytes | 149,106,688 |
| Modeled 30-day capacity, 15-minute cadence, 25% headroom | 536,970,460,160 bytes (about 500 GiB) |

The backup includes the 50 representative boards, a small original smoke board and prior canary receipts. The capacity estimate exceeds the local backup PVC's nominal 100 GiB; full retention capacity is unverified.

### Native browser finding

A cold signed-in profile with Viewer permission on representative board 2 fails to open the canvas. Browser diagnostics show `Read-only hydration generated a mutation`, followed by `Account workspace is stale`. The Owner profile opens the representative 1,100-element canvas and decodes both restored images with exact dimensions and hashes. A second Viewer profile can hydrate that larger canvas but raises `Board is read-only` errors. The post-backup board-0 revocation returns the expected HTTP 404.

This is a failed native-rendering gate. The initial diagnostic identifies the read-only workspace guard; distinguishing incomplete synthetic fixture normalization from an application defect requires a read-only-first regression. The guard was preserved. WINDOWS entry 22 tracks the finding.

### Harness correction

The first attempt's continuous synthetic writes repeatedly restarted a backup from a separate SQLite connection. The corrected harness bounds the burst to 20 writes and resumes the exact saved seed checkpoint without duplicating boards. The successful measured run includes a deliberate post-backup canary. Exact acknowledgment times remain the basis for the loss calculation.

### Changes and verification

- `ddfd11f`: scoped local deployment smoke and documentation; 16 self-tests plus production manifest validation pass.
- `c6c0dfb`: real backup freshness rejection and exact browser replay; Chromium, Firefox and WebKit pass.
- `c3cc75e`: local restart, compatible rollback, selected restore and contract checks; two contract tests pass.
- Both TypeScript checks, JavaScript syntax checks and scoped diff checks pass.


## Acceptance boundary

These results establish local deployment and recovery behavior. Independent physical host/disk failure survival, production storage capacity, production identity-provider integration and production deployment acceptance remain separate gates. The local harness emits scoped `LOCAL_DEPLOYMENT_SMOKE_PASS` and `LOCAL_RECOVERY_DRILL_PASS` markers. No requirement-wide production acceptance is inferred.

## User acceptance

On 2026-09-27, the user accepted the reported local Kubernetes setup and test results. This acceptance records the delivered local validation with its disclosed findings: WINDOWS entry 22 remains open for native Viewer rendering, and independent storage, retention capacity and production infrastructure acceptance remain separate gates. Phase-wide completion is unchanged.


## Approved validation deferral — 2026-09-27

The user postponed independent storage and capacity validation to backlog **999.6**. These infrastructure checks are deferred from active Phase 4 acceptance and remain unverified. Existing local test evidence is retained; WINDOWS 20 is waived for the documented deferral. The cold native Viewer rendering failure (WINDOWS 22) remains active. Production ingress/provider validation retains its separate disposition.


## Automated Viewer-first regression — 2026-09-27

`tests/restored-viewer.spec.ts` (`@04-15-22`) reproduces the native opening failure with an isolated real SQLite backup/restore fixture and production frontend assets. It seeds the same representative data via HTTP, restores after owned live-file loss, and opens boards 2 and 0 in separate fresh Viewer browser contexts before any writer browser hydrates either board.

Run:

```sh
npm exec playwright test -- tests/restored-viewer.spec.ts --project=prod --project=prod-firefox --project=prod-webkit --grep @04-15-22
```

Result: **3 failed, zero skipped** across Chromium, Firefox and WebKit. Both board-opening assertions fail in each browser (six reproduced scenarios). Viewer role checks, explicit write rejection (HTTP 403), absence of browser mutation requests, and exact unchanged document/image/grant graph assertions pass. Native content/image checks run only when the canvas opens. Diagnostics and screenshots are attached for compatible Playwright reporters; failure contexts identify both opening failures.

This is an ordinary failing regression, with no expected-failure annotation or skip. Both repository typechecks pass. The application and recovery fixture remain unchanged; WINDOWS 22 stays open for diagnosis and correction. This reproduction uses local fixture services and does not repeat the destructive Kubernetes drill.


## Viewer-first correction verified — 2026-09-27

WINDOWS 22 is fixed. The representative synthetic frame/image records omitted schema defaults, which BlockSuite attempted to populate during read-only hydration. The fixture now supplies those defaults. Separately, native root title synchronization called the metadata setter during initialization; `BoardMeta` now treats title synchronization as a no-op because the board service owns the title. Scope checks and all non-title write guards remain enforced.

The same `@04-15-22` command above passes **3 tests in 4.2 minutes, zero skipped**: both board types open in each of Chromium, Firefox and WebKit (six scenarios). Native surface/frame counts, decoded image hashes and dimensions, no runtime errors, no browser mutation requests, HTTP 403 write rejection and exact unchanged server graph all pass. Surface counts account separately for the frame block and mind-map container.

Additional checks: all **195 unit tests**, all **3 representative operations-drill tests**, frontend/server TypeScript checks and diff whitespace validation pass. Four metadata tests cover read-only and writable title projection, forbidden Viewer metadata writes, foreign IDs and authorized metadata changes; the title tests failed before the adapter correction and pass afterward.

This correction was verified against freshly restored local fixture services with production frontend assets. The retained Kubernetes image has not been rebuilt or redeployed in this fix; prior cluster timings retain their original revision scope. Independent storage/capacity validation remains deferred to backlog 999.6. Final 04-15 acceptance reconciliation and dependent 04-16 verification remain pending.

## Final local-scope reconciliation — 2026-09-28

Plan 04-15 is complete within the user-accepted local deployment/recovery scope. WINDOWS 22 is fixed and the complete corrected-source browser gate at `5aefe81` passes 1,960/1,960, including the three production-engine Viewer tests and six restored-board scenarios. Earlier failure paragraphs above are historical. The retained cluster image was not redeployed; the fresh fixture/browser evidence is separate from the recorded cluster timings. Independent storage/capacity remains unverified and deferred to 999.6. Final Phase 4 UI/native acceptance and individual prohibition judgments remain in plan 04-16.
