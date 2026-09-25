# Backup publication and inspection

Dali publishes verified SQLite recovery points through the live server's existing connection. The backup contains board root/content documents, image bytes, thumbnails, members, grants, operation receipts and other database state. Treat the whole set as protected data. Restore orchestration, scheduling and retention enforcement are delivered by their subsequent Phase 4 plans.

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
| `databaseVersion` | Supported complete database migration version, currently `8` |
| `epoch` | Captured server recovery epoch; backup itself does not rotate it |
| `recoveryPointAt` | Snapshot start in Unix milliseconds; conservative age anchor |
| `completedAt` | Copy validation/digest completion in Unix milliseconds, before final publication flushes |
| `byteLength`, `sha256` | Exact database file length and full SHA-256 hex digest |
| `counts` | Aggregate boards, documents, images, grants, pending grants, members, receipts, staged imports/images and thumbnails |

The manifest records aggregate counters rather than titles, emails or content. Logs should use sanitized outcomes and these counters; do not log SQL rows, session material, private paths, backup contents or raw storage errors. Errors from the publication/validation boundary are deliberately generic.

## Read-only selection and age

`inspectBackupSet(destination)` returns verified `{id, manifest}` records newest conservative recovery point first. It excludes partial, malformed, tampered, incompatible, permissively accessible and symlinked sets. Inspection preserves existing files and never prunes them. It throws when the destination itself is unavailable or violates its contract. Callers must handle that as unknown/unavailable recovery coverage.

Only an inspected complete set establishes recoverable age. Failed attempts, scheduler wakeups and local snapshots never refresh that age. Retain the last verified set even when stale. The approved operational policy is a 15-minute cadence, at least 30 days of complete recovery points, an alert at 45 minutes, and transactional write fencing at 60 minutes or when the baseline is uncertain. Scheduling, pruning and freshness fencing are integrated in the next backup plan; this publisher retains every prior set.

Restore into fresh empty storage through the later restore procedure, preserve the failed original for operator handling, clear restored authentication state and rotate the recovery epoch before reopening writes. Keep verified published backup files immutable; copy a selected set into restore staging before opening it as a writable application database.

## Evidence and acceptance boundary

The synthetic server tests exercise real online SQLite backup during writes, corruption rejection, fresh owner/editor/viewer authorization, image fidelity, concurrent requests, publication-boundary failures, injected `ENOSPC`/I/O errors and actual child-process `SIGKILL`. They do not fill a production disk or establish independent storage, provider encryption, retention capacity, RPO, RTO or measured throughput. Those require the approved external-storage and recovery drill gates.

References: better-sqlite3 backup API ([https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)); SQLite Online Backup API ([https://www.sqlite.org/backup.html](https://www.sqlite.org/backup.html)); Node.js filesystem API ([https://nodejs.org/api/fs.html](https://nodejs.org/api/fs.html)).
