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
