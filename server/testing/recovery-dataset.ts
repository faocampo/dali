import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import * as Y from 'yjs';

export const recoveryIdentities = ['owner', 'editor', 'viewer'] as const;
export type RecoveryImage = { index: number; width: number; height: number; byteLength: number; sha256: string; key: string; bytes: Buffer };
export type RecoveryBoard = { index: number; owner: number; shared: boolean; ordinaryObjects: number; mindmapNodes: number; imageIndexes: number[] };
export type RecoveryDatasetManifest = {
  schema: 1; seed: number; boards: number; images: number; imageBytes: number;
  boardSpecs: RecoveryBoard[]; imageSpecs: Omit<RecoveryImage, 'bytes'>[];
};
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let crc = n; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); return crc >>> 0;
});
function chunk(kind: string, data: Buffer) {
  const content = Buffer.concat([Buffer.from(kind), data]); let crc = 0xffffffff;
  for (const byte of content) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, content, checksum]);
}
/** Reproducible real RGB scanlines; no external image package or opaque padding payload. */
export function recoveryImage(seed: number, index: number): RecoveryImage {
  const width = index === 0 ? 1536 : 1024; const height = index === 0 ? 1819 : 896;
  let state = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  const raster = Buffer.alloc(height * (width * 3 + 1));
  for (let row = 0; row < height; row++) for (let x = 1; x <= width * 3; x++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    raster[row * (width * 3 + 1) + x] = state & 255;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const parts = [Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raster, { level: 0 }))];
  // Bring the maximum image to exactly 8 MiB with a small valid textual ancillary chunk.
  if (index === 0) { const spare = 8 * 1024 * 1024 - parts.reduce((n, p) => n + p.length, 0) - 24;
    if (spare < 8) throw new Error('Representative raster exceeds envelope');
    parts.push(chunk('tEXt', Buffer.from('seed\0' + String(seed).padEnd(spare - 5, ' ')))); }
  parts.push(chunk('IEND', Buffer.alloc(0))); const bytes = Buffer.concat(parts);
  return { index, width, height, byteLength: bytes.length, sha256: sha256(bytes), key: createHash('sha256').update(bytes).digest('base64').replace(/\+/g, '-').replace(/\//g, '_'), bytes };
}
export function createRecoveryDataset(seed: number): RecoveryDatasetManifest {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Synthetic seed required');
  const imageSpecs = Array.from({ length: 50 }, (_, index) => { const { bytes: _bytes, ...spec } = recoveryImage(seed, index); return spec; });
  const boardSpecs = Array.from({ length: 50 }, (_, index): RecoveryBoard => ({ index, owner: index % 3, shared: index % 2 === 0,
    ordinaryObjects: index === 0 ? 1000 : 100, mindmapNodes: index === 0 ? 100 : 0,
    imageIndexes: index === 0 ? [0, 1] : index === 1 ? [] : [index] }));
  return { schema: 1, seed, boards: boardSpecs.length, images: imageSpecs.length, imageBytes: imageSpecs.reduce((n, image) => n + image.byteLength, 0), boardSpecs, imageSpecs };
}
function map(values: Record<string, unknown>) { return new Y.Map(Object.entries(values)); }
/** Add native BlockSuite wire structures to an existing authorized content document. */
export function populateRecoveryDocument(bytes: Uint8Array, board: RecoveryBoard, manifest: RecoveryDatasetManifest) {
  const doc = new Y.Doc(); Y.applyUpdate(doc, bytes);
  const blocks = doc.getMap<Y.Map<unknown>>('blocks');
  const page = [...blocks.values()].find(value => value.get('sys:flavour') === 'affine:page')!;
  const surface = [...blocks.values()].find(value => value.get('sys:flavour') === 'affine:surface')!;
  const elements = (surface.get('prop:elements') as Y.Map<unknown>).get('value') as Y.Map<unknown>;
  const prefix = `synthetic-${manifest.seed}-${board.index}`;
  const shape = (id: string, n: number) => map({ id, type: 'shape', index: `a${String(n).padStart(5, '0')}`, xywh: `[${(n % 20) * 140},${Math.floor(n / 20) * 100},120,80]`,
    rotate: 0, shapeType: 'rect', shapeStyle: 'General', filled: true, fillColor: '#eeeeff', strokeColor: '#334455', strokeWidth: 2,
    text: new Y.Text(`Synthetic ${board.index} object ${n}`), color: '#223344', fontSize: 16, fontFamily: 'Inter', fontWeight: '400', fontStyle: 'normal', textAlign: 'center' });
  for (let n = 0; n < board.ordinaryObjects - 2; n++) elements.set(`${prefix}-shape-${n}`, shape(`${prefix}-shape-${n}`, n));
  const frameId = `${prefix}-frame`;
  blocks.set(frameId, map({ 'sys:id': frameId, 'sys:flavour': 'affine:frame', 'sys:version': 1, 'sys:children': new Y.Array(),
    'prop:title': new Y.Text('Synthetic frame'), 'prop:xywh': '[-20,-20,600,400]', 'prop:index': 'a0', 'prop:presentationIndex': 'a0', 'prop:lockedBySelf': false, 'prop:background': 'transparent', 'prop:childElementIds': { [`${prefix}-shape-0`]: true } }));
  (surface.get('sys:children') as Y.Array<string>).push([frameId]);
  elements.set(`${prefix}-connector`, map({ id: `${prefix}-connector`, type: 'connector', index: 'b0', xywh: '[0,0,140,100]', mode: 0,
    source: { id: `${prefix}-shape-0`, position: [1, 0.5] }, target: { id: `${prefix}-shape-1`, position: [0, 0.5] }, stroke: '#334455', strokeWidth: 2 }));
  if (board.mindmapNodes) {
    const children = new Y.Map();
    for (let n = 0; n < board.mindmapNodes; n++) { const id = `${prefix}-topic-${n}`; elements.set(id, shape(id, n + 1100));
      children.set(id, { index: `a${String(n).padStart(5, '0')}`, ...(n ? { parent: `${prefix}-topic-${Math.floor((n - 1) / 3)}` } : {}), collapsed: n === 1 }); }
    elements.set(`${prefix}-mindmap`, map({ id: `${prefix}-mindmap`, type: 'mindmap', index: 'c0', children, layoutType: 0, style: 1 }));
  }
  for (const [position, imageIndex] of board.imageIndexes.entries()) {
    const image = manifest.imageSpecs[imageIndex]!; const id = `${prefix}-image-${position}`;
    blocks.set(id, map({ 'sys:id': id, 'sys:flavour': 'affine:image', 'sys:version': 1, 'sys:children': new Y.Array(),
      'prop:caption': '', 'prop:lockedBySelf': false, 'prop:sourceId': image.key, 'prop:xywh': `[${position * 330},-300,300,200]`, 'prop:index': 'd0', 'prop:width': image.width, 'prop:height': image.height, 'prop:size': image.byteLength, 'prop:rotate': 0 }));
    (page.get('sys:children') as Y.Array<string>).push([id]);
    if (position === 1) { const original = manifest.imageSpecs[board.imageIndexes[0]!]!; const editId = `${id}-edit`;
      blocks.set(editId, map({ 'sys:id': editId, 'sys:flavour': 'djai:image-visual-edit', 'sys:version': 1, 'sys:children': new Y.Array(),
        'prop:imageId': id, 'prop:sourceId': original.key, 'prop:processedSourceId': image.key, 'prop:brightness': 12, 'prop:contrast': 8,
        'prop:cropLeft': 10, 'prop:cropTop': 5, 'prop:cropRight': 10, 'prop:cropBottom': 5, 'prop:baseX': 330, 'prop:baseY': -300,
        'prop:baseWidth': 375, 'prop:baseHeight': 222, 'prop:basePixelWidth': original.width, 'prop:basePixelHeight': original.height, 'prop:baseSize': original.byteLength }));
      (page.get('sys:children') as Y.Array<string>).push([editId]); }
  }
  doc.getMap('meta').set('synthetic-seed', manifest.seed);
  const update = Buffer.from(Y.encodeStateAsUpdate(doc)); doc.destroy(); return update;
}
