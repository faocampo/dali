import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRecoveryDataset, recoveryImage, sha256 } from '../testing/recovery-dataset.js';
import { createRepresentativeRecoveryService, durabilityActor } from '../../tests/durability-fixtures.js';
import { validateImageBytes } from '../boards/blobs.js';
import * as Y from 'yjs';

it('@04-15-01 seeded recovery envelope contains fifty boards and at least 128 MiB of real images', () => {
  const manifest = createRecoveryDataset(415);
  expect(manifest.boards).toBe(50);
  expect(manifest.images).toBeGreaterThanOrEqual(50);
  expect(manifest.imageBytes).toBeGreaterThanOrEqual(128 * 1024 * 1024);
}, 30_000);

it('@04-15-01 generated raster dimensions hashes and native semantic references reproduce exactly', () => {
  const a = createRecoveryDataset(415); const b = createRecoveryDataset(415);
  expect(a).toEqual(b); expect(a.imageSpecs[0]!.byteLength).toBe(8 * 1024 * 1024);
  expect(new Set(a.imageSpecs.map(image => image.sha256)).size).toBe(50);
  for (const spec of a.imageSpecs) { const image = recoveryImage(a.seed, spec.index);
    expect(sha256(image.bytes)).toBe(spec.sha256); expect(() => validateImageBytes(image.bytes, 'image/png')).not.toThrow(); }
  expect(a.boardSpecs.filter(board => board.imageIndexes.length === 0)).toHaveLength(1);
  expect(a.boardSpecs[0]).toMatchObject({ ordinaryObjects: 1000, mindmapNodes: 100, imageIndexes: [0, 1] });
  expect(a.boardSpecs.slice(1).every(board => board.ordinaryObjects === 100)).toBe(true);
  expect(new Set(a.boardSpecs.map(board => board.owner)).size).toBe(3);
}, 60_000);

it('@04-15-01 real API acknowledgments survive selected backup after owned live storage loss with exact graph and cold role reads', async () => {
  const fixture = await createRepresentativeRecoveryService(''); const { service, boards, manifest, actors, must } = fixture;
  try {
    const before = fixture.graph(); const board = boards[0]!; const headers = actors[0]!;
    expect(before.images.reduce((n, image) => n + image.bytes, 0)).toBe(manifest.imageBytes);
    expect(before.documents).toHaveLength(100);
    const raw = service.database.prepare('SELECT update_bytes FROM board_documents WHERE doc_id=?').get(board.contentDocId) as { update_bytes: Buffer };
    const doc = new Y.Doc(); Y.applyUpdate(doc, raw.update_bytes);
    const blocks = doc.getMap<Y.Map<unknown>>('blocks');
    const surface = [...blocks.values()].find(block => block.get('sys:flavour') === 'affine:surface')!;
    const elements = (surface.get('prop:elements') as Y.Map<unknown>).get('value') as Y.Map<Y.Map<unknown>>;
    expect(elements.size).toBe(1100); // 998 shapes, one connector, 100 topics, one mind map; frame is a block.
    expect((elements.get('synthetic-415-0-mindmap')!.get('children') as Y.Map<unknown>).size).toBe(100);
    expect(elements.get('synthetic-415-0-connector')!.get('source')).toEqual({ id: 'synthetic-415-0-shape-0', position: [1, 0.5] });
    const edit = blocks.get('synthetic-415-0-image-1-edit')!;
    expect(edit.get('prop:sourceId')).toBe(manifest.imageSpecs[0]!.key); expect(edit.get('prop:processedSourceId')).toBe(manifest.imageSpecs[1]!.key);
    expect(edit.get('prop:cropLeft')).toBe(10); doc.destroy();
    const canaries: { sequence: number; title: string; submittedAt: number; acknowledgedAt: number; operationId: string }[] = [];
    let running = true; const cadenceMs = 100;
    const writer = (async () => {
      while (running) {
        const descriptor = await (await must(await fetch(`${service.origin}/api/boards/${board.summary.id}`, { headers }))).json() as { revision: number };
        const submittedAt = Date.now(); const sequence = canaries.length + 1; const operationId = randomUUID(); const title = `Synthetic canary ${sequence} at ${submittedAt}`;
        await must(await fetch(`${service.origin}/api/boards/${board.summary.id}`, { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ title, revision: descriptor.revision, operationId }) }));
        canaries.push({ sequence, title, submittedAt, acknowledgedAt: Date.now(), operationId });
        await new Promise(resolve => setTimeout(resolve, Math.max(0, cadenceMs - (Date.now() - submittedAt))));
      }
    })();
    const backupStarted = performance.now();
    let selected: Awaited<ReturnType<typeof service.backup>>;
    try { selected = await service.backup(); } finally { running = false; await writer; }
    const backupMs = performance.now() - backupStarted;
    expect(canaries.length).toBeGreaterThan(1);
    const incidentAt = Date.now(); const restoreStarted = performance.now();
    await service.restore(selected, undefined, true);
    const restored = fixture.graph();
    expect(restored.documents).toEqual(before.documents); expect(restored.images).toEqual(before.images); expect(restored.grants).toEqual(before.grants);
    const restoredBoard = restored.boards.find(row => (row as { id: string }).id === board.summary.id) as { title: string; revision: number };
    const included = canaries.find(canary => canary.title === restoredBoard.title);
    expect(included).toBeDefined();
    for (const [index, restoredRow] of restored.boards.entries()) {
      const old = before.boards[index] as { id: string; title: string; revision: number };
      expect(restoredRow).toEqual(old.id === board.summary.id ? { ...old, title: included!.title, revision: old.revision + included!.sequence } : old);
    }
    for (const [actorIndex, identity] of ['owner', 'editor', 'viewer'].entries()) {
      const cold = await durabilityActor(service.origin, identity, service.operatorHeaders);
      for (const [index, item] of boards.entries()) {
        const spec = manifest.boardSpecs[index]!; const permitted = spec.shared || spec.owner === actorIndex;
        const response = await fetch(`${service.origin}/api/boards/${item.summary.id}`, { headers: cold });
        expect(response.status).toBe(permitted ? 200 : 404);
        if (!permitted) { for (const imageIndex of spec.imageIndexes) expect((await fetch(`${service.origin}/api/boards/${item.summary.id}/blobs/${manifest.imageSpecs[imageIndex]!.key}`, { headers: cold })).status).toBe(404); continue; }
        expect((await response.json() as { summary: { role: string } }).summary.role).toBe(actorIndex === spec.owner ? 'owner' : actorIndex === (spec.owner + 1) % 3 ? 'editor' : 'viewer');
        for (const docId of [item.rootDocId, item.contentDocId]) {
          const pulled = await must(await fetch(`${service.origin}/api/boards/${item.summary.id}/docs/${docId}/pull`, { method: 'POST', headers: { ...cold, 'content-type': 'application/octet-stream' }, body: new Uint8Array([0]) }));
          expect(sha256(new Uint8Array(await pulled.arrayBuffer()))).toBe(before.documents.find(document => document.doc_id === docId)!.sha256);
        }
        for (const imageIndex of spec.imageIndexes) { const image = manifest.imageSpecs[imageIndex]!;
          const response = await must(await fetch(`${service.origin}/api/boards/${item.summary.id}/blobs/${image.key}`, { headers: cold }));
          expect(sha256(new Uint8Array(await response.arrayBuffer()))).toBe(image.sha256); }
      }
      const permission = await fetch(`${service.origin}/api/boards/${board.summary.id}/docs/${board.contentDocId}/push`, { method: 'POST', headers: { ...cold, 'content-type': 'application/octet-stream' }, body: new Uint8Array([0, 0]) });
      expect(permission.status).toBe(identity === 'viewer' ? 403 : 200);
    }
    service.openIngress(); const restoreMs = performance.now() - restoreStarted;
    const report = { schema: 1, seed: manifest.seed, boards: manifest.boards, images: manifest.images, imageBytes: manifest.imageBytes,
      backupBytes: selected.manifest.byteLength, backupMs, restoreMs, cadenceMs, acknowledgedCanaries: canaries.length, restoredSequence: included!.sequence,
      recoveryPointAgeMs: incidentAt - selected.manifest.recoveryPointAt, acknowledgedLossMs: canaries.at(-1)!.acknowledgedAt - included!.acknowledgedAt,
      capacity30DaysWith25PercentHeadroom: Math.ceil(selected.manifest.byteLength * (30 * 24 * 4 + 1) * 1.25), failureDomain: 'local-owned-directories' };
    expect(report.recoveryPointAgeMs).toBeLessThan(3_600_000); expect(report.acknowledgedLossMs).toBeLessThan(3_600_000);
    await mkdir('.gsd', { recursive: true });
    await writeFile('.gsd/representative-recovery.json', JSON.stringify({ report, manifest, content: before }, null, 2) + '\n');
    process.stdout.write('REPRESENTATIVE_LOCAL_IO_PASS ' + JSON.stringify(report) + '\n');
  } finally { await service.close(); }
}, 240_000);
