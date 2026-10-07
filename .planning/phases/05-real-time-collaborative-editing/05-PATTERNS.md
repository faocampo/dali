# Phase 5 — Existing implementation patterns

Inspected 2026-10-02. Inline source mapping for the Codex adapter. New paths below are planned deliverables; check current files before creating them.

| Planned module / responsibility | Closest existing analog | Required adaptation |
|---|---|---|
| `server/boards/collaboration.ts`, `reservations.ts`, `presence.ts` | `server/boards/documents.ts`, `routes.ts`, `grants.ts` | Reuse current-session and commit-time capability checks; long-lived responses reauthorize at delivery |
| `server/boards/change-footprint.ts` | `server/boards/documents.ts` validation; `src/canvas/mindmap-compatibility.ts` hierarchy checks | Walk native surface elements and structural effects, not just top-level blocks; authoritative server logic cannot trust client lists |
| `src/canvas/account/live-source.ts` | `src/canvas/account/doc-source.ts` | Scoped abort/current-generation pattern; real remote feed replacing disposal-only subscription |
| `src/canvas/account/reservations.ts` | `src/canvas/account/mutation-guard.ts` | Guard native entry points before mutation while preserving trusted remote application |
| `src/header/Participants.tsx`, `participants.css` | `src/header/Header.tsx`, `src/header/Dropdown.tsx`, `src/styles/tokens.css` | Existing shell disclosure/focus/tokens; no new package |
| `src/canvas/account/personal-history.ts` | `src/canvas/account/board-doc.ts`, `mutation-guard.ts` | Native Store history plus per-tab origins/session boundaries and server-validatable inverse eligibility |
| `src/canvas/account/recovery-baseline.ts`, `server/boards/recovery-baseline.ts` | `src/canvas/account/title-intent.ts`, `outbox.ts`, `server/boards/documents.ts` | Exact receipt ordering extended to isolated snapshot divergence; additive compatible local metadata |
| `server/boards/recovery-forks.ts` | `server/boards/actions.ts`, `imports.ts`, `src/boards/operations.ts` | Stage local snapshot's own image manifest and new IDs; preserve source board and current authority |
| `src/canvas/RecoveryVersionDialog.tsx` | `src/header/LeaveRecoveryDialog.tsx`, `src/canvas/RecoveryStateView.tsx`, `src/header/SaveDetails.tsx` | Modal focus, cancel, explicit local-discard/download decision, no overwrite |
| `tests/collaboration-fixtures.ts`, browser suites | `tests/access-fixtures.ts`, `tests/durability-fixtures.ts`, `tests/recovery-fixtures.ts` | Distinct authenticated accounts, native gestures, real service barriers and cold reopen |
| New server/unit tests | `server/boards/access.test.ts`, `server/boards/recovery.test.ts`, `src/canvas/account/recovery.test.ts` | Deterministic acquire/commit/revoke barriers and side-effect assertions |

## Concrete patterns

From `server/boards/routes.ts`, effective-role and durable admission:

```ts
if (member!.systemRole === 'viewer' && board.role !== 'owner') board.role = 'viewer';
if (!canBoard(board.role, capability)) { reply.code(403).send({ code: 'CAPABILITY_REQUIRED' }); return; }
```

The same function checks `requireDurableWriteAdmission` inside mutation transactions. Preserve both request-time and transaction-time authorization; initial subscription is not lifetime permission.

From `src/canvas/account/doc-source.ts`, current subscription seam:

```ts
subscribe(_callback: (docId: string, data: Uint8Array) => void, disconnect: (reason: string) => void) {
  const abort = () => disconnect('account-source-disposed');
  this.options.signal?.addEventListener('abort', abort, { once: true });
  return () => this.options.signal?.removeEventListener('abort', abort);
}
```

New delivery must retain cleanup and avoid feeding remote updates back as local outbound changes.

From `src/canvas/account/recovery.ts`, current replay sequence:

```ts
const pending = await d.inspect(authority); this.assertCurrent(signal);
if (pending) {
  this.emit('recovering');
  await d.drain(authority, signal); this.assertCurrent(signal);
}
```

Insert the durable baseline and choice gate before drain and before title replay. Its absence would violate D-11 even if Yjs converges.

From `src/canvas/mindmap-compatibility.ts`, native hierarchy validation:

```ts
while (parent) {
  if (visited.has(parent) || !map.children.has(parent)) throw new Error('The mind map contains invalid topic parents.');
  visited.add(parent);
  parent = map.children.get(parent)!.parent;
}
```

Current code also requires a single central topic. Server validation and multi-object reservation must enforce equivalent hierarchy constraints without importing DOM-dependent code.

## Reuse boundaries

Keep generation-bound callbacks and per-board root/content identity. Existing generic duplicate copies server state and is not the local recovery fork. Existing read-only model guards do not establish safe live remote application. Existing automatic replay and native history grouping need explicit extension; naming an analog does not prove behavioral equivalence.
