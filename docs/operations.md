# Backup publication and inspection

Dali publishes verified SQLite recovery points through the live server's existing connection. The backup contains board root/content documents, image bytes, thumbnails, members, grants, operation receipts and other database state. Treat the whole set as protected data. Automatic scheduling and retention run in that process; restore orchestration follows its separate procedure.

## Destination contract

Supply a pre-provisioned mounted directory through `BackupDestination`:

```ts
const destination = {
  directory: '/mnt/dali-backups',
  independentStorage: true,
} as const;
```

The path above is synthetic. The operator owns the actual mount, credentials and settings outside the public repository. `independentStorage: true` is an explicit operator assertion; software cannot infer a separate failure domain from two paths, volume names or filesystem device numbers. Confirm privately that the backup destination survives loss of live storage before accepting OPS-02. Local fixture destinations establish software behavior only.

The destination must already exist, have mode `0700`, and resolve to a directory rather than a symlink. The publisher creates set directories with mode `0700` and files with mode `0600`. Protect parent directories and the mount against replacement or modification by other users. Restrict backup read/restore/delete authority; backups include full content and authentication/session metadata. Configure encryption at rest, key recovery, mount credentials and access auditing in operator infrastructure.

Required filesystem semantics:

- Durable file and directory `fsync`, atomic same-filesystem rename, and reliable SQLite locking on live storage.
- One live SQLite writer, with its database/WAL/SHM together. Invoke backup through that process's owned connection. Fence the old writer before starting another process or restoring a database.
- Enough independent capacity for at least 30 days of complete snapshots, an additional in-flight snapshot, filesystem overhead and operational headroom. Measure actual snapshot sizes and throughput. No compression or deduplication savings are assumed.
- Monitoring and an operator response path for unavailable/full storage, failed flushes, stale recovery points and retention shortfalls.

The publisher rejects the live database directory as its destination. This check prevents an obvious configuration error; the operator's independent-storage assertion still requires external evidence.

## Publication protocol

`publishBackup({database, destination, applicationVersion})` returns `{id, manifest}` only after completion. Calls with the same connection/destination/version while a publication is in flight share one promise. A conflicting destination/version is rejected. Process-level exclusivity relies on the deployment's single-writer contract; this module never opens a second connection to live storage.

1. Record a conservative snapshot-start recovery point and create a unique hidden `.partial` directory on the destination filesystem.
2. Use the asynchronous SQLite online backup API through the owned live connection. Writes on that connection may continue and can be included in the resulting snapshot.
3. Normalize only the completed copy to SQLite DELETE journal mode, then open it read-only. This keeps the archived database self-contained and prevents inspection from creating WAL/SHM companions. Check SQLite integrity/foreign keys, supported migration ledger, complete Yjs root/content bindings, document/image limits, every referenced image, MIME/hash integrity and access/receipt relationships. Legitimate receipts may outlive a deleted board; unfinished import stages retain their partial state and references.
4. Compute the full database SHA-256 and byte count. Flush the database, exclusively write and flush the manifest, and flush the temporary directory.
5. Atomically rename the set directory and flush the destination directory.
6. Write and flush a temporary completion marker, rename it to `COMPLETE`, and flush the set and destination directories before returning success.

A completed set contains `database.sqlite`, `manifest.json` and `COMPLETE`. The marker contains the database SHA-256 plus a newline. It is written last. Consumers always verify the marker, manifest, digest, supported schema and database contents before selection. Neither a directory name nor a finished local snapshot is success.

On a caught failure, cleanup touches only the unique directory created by that invocation. Existing complete sets remain intact. An abrupt process interruption can leave hidden or visible incomplete sets; inspection excludes them. No blanket cleanup or pruning runs during publication. After recovery from an interrupted process, an operator can review abandoned partial sets separately from verified recovery points.

Filesystem failures after writing a marker can leave uncertain directory persistence. A caught failure removes only that invocation's set where the destination permits cleanup. After an abrupt crash, a surviving set is usable only if complete independent verification passes. Actual flush behavior and storage-loss survival require the deployment drill.

## Manifest version 1

| Field | Meaning |
|---|---|
| `schemaVersion` | Manifest schema, currently `1` |
| `applicationVersion` | Caller-supplied release identifier; does not imply future binary compatibility |
| `databaseVersion` | Supported complete database migration versions `8` and `9`; version 9 adds schedule metadata |
| `epoch` | Captured server recovery epoch; backup itself does not rotate it |
| `recoveryPointAt` | Snapshot start in Unix milliseconds; conservative age anchor |
| `completedAt` | Copy validation/digest completion in Unix milliseconds, before final publication flushes |
| `byteLength`, `sha256` | Exact database file length and full SHA-256 hex digest |
| `counts` | Aggregate boards, documents, images, grants, pending grants, members, receipts, staged imports/images and thumbnails |

The manifest records aggregate counters rather than titles, emails or content. Logs should use sanitized outcomes and these counters; do not log SQL rows, session material, private paths, backup contents or raw storage errors. Errors from the publication/validation boundary are deliberately generic.

## Read-only selection and age

`inspectBackupSet(destination)` returns verified `{id, manifest}` records newest conservative recovery point first. It excludes partial, malformed, tampered, incompatible, permissively accessible and symlinked sets. Inspection preserves existing files and never prunes them. It throws when the destination itself is unavailable or violates its contract. Callers must handle that as unknown/unavailable recovery coverage.

Only an inspected complete set establishes recoverable age. Failed attempts, scheduler wakeups and local snapshots never refresh that age. Retain the last verified set even when stale. The approved operational policy is a 15-minute cadence, at least 30 days of complete recovery points, an alert at 45 minutes, and transactional write fencing at 60 minutes or when the baseline is uncertain.

## Automatic scheduling and startup recovery

Provision the independent restricted directory before starting the service. Configure these values exclusively in operator infrastructure:

| Setting | Default and permitted policy |
|---|---|
| `DALI_BACKUP_DIRECTORY` | Required absolute path to the existing restricted independent destination |
| `DALI_BACKUP_INDEPENDENT_STORAGE` | Required `true`, asserting externally verified independent storage |
| `DALI_BACKUP_INTERVAL_MS` | `900000`; may be shortened, minimum 1000, never longer than 15 minutes or maximum age |
| `DALI_BACKUP_RETENTION_DAYS` | `30`; may be increased, never reduced below 30 |
| `DALI_BACKUP_MAX_AGE_MS` | `3600000`; may be shortened to at least 60000, never increased beyond one hour |

Startup independently inspects the destination and current recovery epoch, then publishes a due or missing baseline. Writes remain fenced until valid coverage exists. A single scheduler serializes work through the live database connection. Checks run every minute (or the shorter configured interval); missed wakeups trigger one current backup rather than a backlog. Closing the service cancels its timer and waits for the in-flight publication before closing owned storage. Scheduler completion/check metadata persists additively in `recovery_state`; metadata alone cannot establish coverage after restart.

Authenticated `GET /api/storage-health` with the expected-account header returns sanitized backup state, reason, recoverable age, recovery-point timestamp and publication/retention failure category. Monitor this endpoint and alert on `alert` or `fenced`, including capacity and publication failures. Defaults alert at 45 minutes and fence at exactly 60; a stricter maximum age alerts at 75% of its bound. Logs/monitoring must retain only sanitized fields.

In-process age is the maximum of wall-clock age and monotonic elapsed age. Clock rollback, invalid values, or wall/monotonic divergence exceeding 60 seconds conservatively fence the process; restart also rejects wall time earlier than its persisted last valid check or inspected recovery timestamps. Correct the host clock, restart, verify a current complete backup and inspect health before reopening writes. No process can infer unobserved clock manipulation while it was stopped: trustworthy host time and monitoring remain deployment prerequisites.

After a newer independently verified publication, retention removes only complete verified sets with completion times strictly older than the retention window and older recovery points. It preserves the newest set and at least the newly verified set. Incomplete/corrupt sets remain for operator review. Failed publication never prunes; failed deletion or directory flush alerts while retaining renewed coverage and remaining sets. Pruning errors may leave some eligible old sets already removed; they never shorten the required retention window.

For an unavailable destination, repair the mount, permissions or capacity while leaving the service's read/authentication paths available. The next automatic check retries publication and renewed verified coverage restores write admission. Keep current memory/local pending work while receiving `503 BACKUP_FRESHNESS_REQUIRED` with `Retry-After`; it is a retryable storage condition. Pending-grant activation is deferred during fencing, allowing sign-in to succeed; signing in again after coverage renewal retries activation.

Programmatic tests can explicitly inject `storagePolicy: {kind: 'fixture'}` or a deterministic health provider. The production entrypoint accepts neither through environment configuration. Such tests establish route behavior only; they do not demonstrate real independent-storage recovery guarantees.

Restore into fresh empty storage through the procedure below. Keep verified published backup files immutable.

## Operator-selected offline restore

Use the compiled `server/operator.js` from the compatible release. The commands below use synthetic paths; supply private values in operator infrastructure. `inspect` verifies one explicitly selected set and returns its manifest digest. Record that digest with the operator's selection, then pass it to `restore`.

```sh
node server/operator.js inspect --backup /mnt/dali-backups/backup-EXPLICIT-SELECTION
node server/operator.js restore \
  --backup /mnt/dali-backups/backup-EXPLICIT-SELECTION \
  --expected-manifest-digest SELECTED_MANIFEST_SHA256 \
  --destination /mnt/dali-fresh \
  --source-database /mnt/dali-old/database.sqlite \
  --maintenance-confirmed \
  --writer-fenced writer-stopped \
  --fence-evidence 'Operator record confirming old writer termination'
node server/operator.js verify --destination /mnt/dali-fresh
```

The operator provisions a distinct empty mode-0700 destination and controls its parent directory and all ancestor mounts against replacement. The old source parent remains available for canonical-path comparison even when its database has been lost. `--writer-fenced` accepts `writer-stopped` or `storage-fenced`; its evidence is a required operator attestation backed by infrastructure observations. The command cannot prove remote process termination or storage detachment. Confirm termination/fencing externally before invoking it. An empty flag or merely inaccessible endpoint is insufficient evidence.

Restore validates completion, manifest digest, database size/digest, supported schema, Yjs decoding, images and relationships before changing the destination. It copies into private sibling staging, verifies the copied bytes again, applies compatible additive migrations, clears login transactions then sessions, rotates a random recovery epoch and clears stale backup coverage. It preserves members, owners, grants and operation receipts. After offline integrity verification and flushing, it replaces only the empty target directory with the prepared directory. Nonempty targets, symlinks, unexpected WAL/SHM companions, absent fencing confirmation and invalid sets fail with nonzero status. Failed staging cleanup touches only that invocation's private directory. A failure after publication can leave a complete fresh target for explicit verification; ingress stays closed.

The sanitized `RestoreReport` includes selected backup ID/digest, conservative recovery point, restore time, old/new epochs and aggregate integrity counters. `verify` runs offline before startup and requires cleared sessions and no WAL/SHM companions. It does not reopen ingress or certify subsequent access reconciliation. Once the application starts, use the signed access/content checks below instead of rerunning offline verification on a live WAL database.

## Ordered recovery and access verification

1. Record the storage-failure incident time. Keep this disaster timer separate from a planned-maintenance timer. Both approved outage ceilings are 24 hours; measure through verified usable service and the deliberate ingress reopening, including provisioning and private configuration recovery.
2. Close public ingress and suspend routing to the failed writer. Stop the writer, await termination and confirm the old storage cannot receive writes. If termination cannot be proven, apply infrastructure storage fencing. Retain the infrastructure evidence privately. Prevent automatic replacement pods from mounting old or fresh storage during this step.
3. Retain the old database, WAL and SHM together in their original location for diagnosis. Never mix an old WAL/SHM with a selected backup, overlay a live file or open two writers. Preserve old storage until a separately approved disposal decision.
4. Inspect an explicitly selected complete set and record its manifest digest, conservative recovery point and observed acknowledged-canary loss. Compare the recovery point and actual missing acknowledged work with the one-hour RPO. Scheduled intervals and manifests alone do not establish loss. Escalate stale or incomplete coverage; do not silently select a different recovery point.
5. Provision fresh private empty storage and run `restore` with maintenance/fencing evidence, then `verify` while offline. Stop on any nonzero exit. The compatible release supports migration 8 or 9 and adds schedule metadata when needed. An unsupported schema requires a reviewed migration/recovery decision.
6. Reconcile all access changes after the selected point from an independently retained operator audit ledger: removed membership, revoked active and pending grants, changed roles and ownership. Apply those changes offline or through a private operator-only service before ordinary sign-in. Remove revoked pending grants before authentication can activate them. Confirm no unresolved ledger interval remains. Reconciliation cannot be inferred from the selected backup.
7. Attach the operator-managed origin, identity-provider registration, membership policy, TLS, secret store, session secret, independent backup mount and encryption/key recovery configuration. Keep these settings and evidence outside this repository. Restore contains no deployment credentials. Confirm the same stable identity mapping and appropriate fresh-session lifetime.
8. Start a single compatible service against fresh storage behind closed public ingress, allowing only the verification operator. Startup must create and independently verify a new-epoch backup baseline before accepting durable mutations. Inspect `/api/storage-health`; a fenced state keeps mutations paused. Confirm another automatic publication occurs and that retention/monitoring resumes.
9. Use cold browser profiles with signed fresh Owner, Editor and Viewer identities to reopen selected documents and compare image bytes. Exercise a reconciled denied identity against both documents and image URLs. Confirm pre-restore cookies fail. Confirm an old browser receives the restore epoch warning, its pending journal remains separately retained, and stale submissions fail; explicitly opening the restored board must preserve that journal.
10. Verify read/write capabilities and current-epoch saving after healthy backup coverage. Record the selected-content checks, loss measurements, scheduler resumption and actual elapsed disaster recovery time. Only the operator then reopens public ingress. Stop the timer at verified usable service with public routing restored. This command provides no automatic ingress reopening.

For planned maintenance, start its own timer when ingress closes, drain/stop the writer, preserve its database/WAL/SHM together and restart one compatible binary using the existing database. Verify cold access and current backup coverage before reopening. A compatible binary rollback is a deployment change using the same supported schema. Restoring a database is a separately selected recovery operation that rotates the epoch and invalidates sessions; it can discard acknowledged work after its recovery point.

**Operator decision checkpoint:** Before destructive replacement of real storage, incompatible schema migration, deleting old storage or changing the selected recovery point, present the exact affected resources, data-loss implications and rollback/recovery path for explicit operator approval. The automated repository drill performs fresh-target synthetic restoration only. Production failure-domain survival, private secret recovery, ledger completeness and the representative deployment's one-hour/24-hour objectives remain external acceptance gates.

## Evidence and acceptance boundary

The synthetic server tests exercise real online SQLite backup during writes, corruption rejection, fresh owner/editor/viewer authorization, image fidelity, concurrent requests, publication-boundary failures, injected `ENOSPC`/I/O errors and actual child-process `SIGKILL`. They do not fill a production disk or establish independent storage, provider encryption, retention capacity, RPO, RTO or measured throughput. Those require the approved external-storage and recovery drill gates.

References: better-sqlite3 backup API ([https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)); SQLite Online Backup API ([https://www.sqlite.org/backup.html](https://www.sqlite.org/backup.html)); Node.js filesystem API ([https://nodejs.org/api/fs.html](https://nodejs.org/api/fs.html)).

Scheduling references: Node.js timers ([https://nodejs.org/api/timers.html](https://nodejs.org/api/timers.html)); Node.js monotonic performance clock ([https://nodejs.org/api/perf_hooks.html#performancenow](https://nodejs.org/api/perf_hooks.html#performancenow)). Timers can run late; transaction-time admission enforces the bound independently of timer delivery.

## Representative local recovery envelope

Run the owned synthetic dataset and local I/O gate with:

```sh
npm run test:server -- server/storage/operations-drill.test.ts -t @04-15-01
npm exec playwright test -- tests/restored-board.spec.ts --project=prod --grep @04-15-01
npm run test:server -- server/storage/backup-scheduler.test.ts server/boards/access.test.ts
```

The seed-415 generator creates 50 boards owned across three synthetic identities. Each ordinary board has 100 editable objects; the large board has 1,000 ordinary objects plus 100 mind-map nodes. Native structures include a frame, bound connector endpoints, styled topics, a collapsed branch and image edit metadata referencing both original and processed assets. Private and shared boards exercise Owner, Editor, Viewer and denied access. The zero/one/many-image distribution references 50 distinct PNGs with real seeded RGB scanlines, more than 128 MiB total and an exact 8 MiB largest file. The manifest records schema, seed, dimensions, individual bytes and SHA-256 hashes.

The HTTP fixture signs in through synthetic OIDC, writes images/documents through authorized APIs, and records timestamped rename acknowledgments at a target 100 ms cadence while a real online backup runs. Timer delays are reflected in the actual recorded acknowledgment times. After explicitly selecting the resulting manifest digest, it stops the owned writer, deletes only its synthetic live files and restores into a fresh restricted directory. It compares every document and image digest and the board/grant graph, verifies the included canary sequence, signs in afresh for all three identities and reads every authorized document/image while checking private denials. The browser gate additionally hydrates the representative native canvas and decodes its images from fresh browser profiles.

Generated `.gsd/representative-recovery.json` contains the measured local report, dataset manifest and content digests. It remains ignored runtime output. The report records actual backup/restore durations, byte counts, acknowledged loss window, recovery-point age and capacity at a 15-minute cadence. Capacity uses `(30 × 24 × 4 + 1) × measured backup bytes × 1.25`, including the retention-boundary set and 25% headroom. Existing clock-based tests independently exercise retention policy and payload limits.

This gate establishes the measured local filesystem envelope. Its live/backup directories share one host. Production acceptance still requires the explicit disposable Kubernetes context, surviving independent storage, synthetic TLS/OIDC, image availability, writer fencing and complete timed deployment/disaster/maintenance gates. Preserve those prerequisites and the separate 1-hour RPO / 24-hour RTO / 24-hour maintenance bounds when recording acceptance.

Fixture encoding reference: Yjs document update API ([https://docs.yjs.dev/api/document-updates](https://docs.yjs.dev/api/document-updates)); native object representation follows the installed BlockSuite 0.22.4 schemas used by board creation.


## Browser recovery after backup freshness fencing

Run the real HTTP rejection and recovery scenario in each supported browser:

```sh
npm exec playwright test -- tests/backup-fence.spec.ts --project=prod --project=prod-firefox --project=prod-webkit --grep @04-15-03
```

The fixture runs the production backup scheduler and publishes real SQLite backups. A test-only scheduler clock advances to the 45-minute alert, the 60-minute write cutoff, and a further 24-hour maintenance interval. Document and image writes receive actual `503 BACKUP_FRESHNESS_REQUIRED` responses. Browser journal entries remain pending; resumed verified coverage triggers a fresh access check, and an older held acknowledgment cannot mark a newer edit Saved. Final exact acknowledgment clears the journal, and a reload retains both notes and the image. The 24-hour advance establishes clock-boundary behavior; elapsed maintenance time is measured separately by the Kubernetes recovery drill.

## Disposable local Kubernetes recovery drill

After the explicitly local deployment smoke succeeds, use the same external synthetic fixture and isolated context:

```sh
node scripts/recovery-drill.mjs --local --synthetic \
  --context kind-dali-local-example --namespace dali-smoke-example \
  --fixture /private-runtime/fixture.json --report /private-runtime/recovery-report.json \
  --rollback-app-image dali-app:previous-compatible \
  --rollback-web-image dali-web:previous-compatible
```

The command requires existing owned smoke resources, verified storage semantics and explicit previous compatible images. It seeds 50 boards and 50 generated images through authenticated APIs, verifies cold content after fenced restart and rollback, records acknowledgments during backup, and selects the manifest digest. With ingress closed and the old writer terminated, an operator pod removes only the three selected synthetic SQLite companion files and restores into a fresh directory. It verifies the restored epoch, invalidated sessions, exact content, reconciled post-backup revocation, current roles and resumed backup coverage before reopening ingress. The private report records observed timings and capacity estimates. `LOCAL_RECOVERY_DRILL_PASS` applies to this local envelope.

Separate local PV directories share the container host and backing volume. Host/disk failure survival, production storage capacity and production infrastructure acceptance require an independently provisioned environment. The private runtime fixture and generated state/report stay outside the repository. A successful drill leaves the restored deployment running for inspection; further destructive runs require a fresh explicitly selected synthetic deployment.
