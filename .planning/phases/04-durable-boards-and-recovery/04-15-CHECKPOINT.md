# Plan 04-15 Recovery Acceptance Checkpoint

Date: 2026-09-27

Tasks 04-15-01 and 04-15-03 are complete. Task 04-15-02 has implemented and passed the user-authorized local Kubernetes API recovery drill. The cluster remains available through a private isolated kubeconfig; runtime paths and credentials stay outside the repository.

## Completed local evidence

- Production images, synthetic signed OIDC/PKCE over HTTPS, enforced network restrictions and local storage semantics.
- One-writer fencing, replacement pod persistence, actual compatible rollback and return.
- Fifty representative boards and 50 images; explicit backup selection, live SQLite file loss and fresh-target restore.
- Exact cold API document/image hashes and role checks; invalidated sessions, changed epoch, reconciled post-backup revocation and renewed backups.
- Chromium, Firefox and WebKit freshness-fence recovery, with a simulated 24-hour scheduler interval and actual HTTP rejection/publication.

## Remaining work

1. WINDOWS entry 22 is fixed and verified with isolated real backup/restore services and production frontend assets in Chromium, Firefox and WebKit. Reconcile this evidence in final plan acceptance; the retained Kubernetes image has not been redeployed with this correction.
2. **Deferred by the user on 2026-09-27 to backlog 999.6:** independent physical storage failure survival and production capacity validation. These checks no longer block active Phase 4 acceptance. Separate local PV directories share one Docker backing volume/host. The measured 30-day forecast is about 500 GiB versus the test claim's nominal 100 GiB.
3. Finish plan 04-15 acceptance before the dependent 04-16 final verification.

See [04-LOCAL-KUBERNETES-VALIDATION.md](04-LOCAL-KUBERNETES-VALIDATION.md) (test results and measurements). Preserve completed work and private runtime evidence. Do not rerun destructive recovery against the already restored target; use a freshly selected synthetic deployment.

Automated regression: `tests/restored-viewer.spec.ts`, tag `@04-15-22`, now passes all three browser tests (six board scenarios, zero skipped). Native content and decoded images, absence of runtime errors and mutation requests, HTTP 403 write rejection and exact server-state preservation pass. Both typechecks, 195 unit tests and all three representative operations-drill tests pass.
