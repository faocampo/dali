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

Restore into fresh empty storage through the later restore procedure, preserve the failed original for operator handling, clear restored authentication state and rotate the recovery epoch before reopening writes. Keep verified published backup files immutable; copy a selected set into restore staging before opening it as a writable application database.

## Evidence and acceptance boundary

The synthetic server tests exercise real online SQLite backup during writes, corruption rejection, fresh owner/editor/viewer authorization, image fidelity, concurrent requests, publication-boundary failures, injected `ENOSPC`/I/O errors and actual child-process `SIGKILL`. They do not fill a production disk or establish independent storage, provider encryption, retention capacity, RPO, RTO or measured throughput. Those require the approved external-storage and recovery drill gates.

References: better-sqlite3 backup API ([https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)); SQLite Online Backup API ([https://www.sqlite.org/backup.html](https://www.sqlite.org/backup.html)); Node.js filesystem API ([https://nodejs.org/api/fs.html](https://nodejs.org/api/fs.html)).

Scheduling references: Node.js timers ([https://nodejs.org/api/timers.html](https://nodejs.org/api/timers.html)); Node.js monotonic performance clock ([https://nodejs.org/api/perf_hooks.html#performancenow](https://nodejs.org/api/perf_hooks.html#performancenow)). Timers can run late; transaction-time admission enforces the bound independently of timer delivery.
