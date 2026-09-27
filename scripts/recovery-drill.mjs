#!/usr/bin/env node
/** Explicitly local destructive drill. Private fixture/report paths and real cluster evidence are mandatory. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const pause = ms => new Promise(r => setTimeout(r, ms));
let gate = 'explicit local synthetic context';
export function parseOptions(args) {
  const names = ['--context', '--namespace', '--fixture', '--report', '--rollback-app-image', '--rollback-web-image'];
  const o = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--local' || key === '--synthetic' || key === '--resume-seed') { assert(!o[key], 'duplicate flag'); o[key] = true; }
    else { assert(names.includes(key) && !o[key] && args[i + 1] && !args[i + 1].startsWith('--'), 'unknown or missing option'); o[key] = args[++i]; }
  }
  assert(o['--local'] && o['--synthetic'] && /^kind-dali-local-[a-z0-9-]+$/.test(o['--context'] ?? ''), gate);
  assert(/^dali-smoke-[a-z0-9-]+$/.test(o['--namespace'] ?? ''), 'explicit owned smoke namespace');
  for (const n of names) assert(o[n], 'all private runtime bindings required');
  for (const n of ['--fixture', '--report']) assert(!resolve(o[n]).startsWith(root), 'private files must remain outside repository');
  assert(resolve(o['--report']) !== resolve(o['--fixture']), 'report must not overwrite fixture');
  return o;
}
export function validateLocalFixture(f) {
  assert(f.synthetic === true && f.disposable === true && f.validationScope === 'local', 'local synthetic fixture required');
  assert(f.independentBackupVerified === false && f.liveStorageLossIsolationVerified === true, 'shared-host limitation required');
  assert(f.storageAccessMode === 'ReadWriteOnce' && f.singleWriterFencingVerified === true && f.storageSemanticsVerified === true, 'local storage checks required');
  assert(f.ingressMode === 'synthetic-https-proxy' && f.auth.DALI_OIDC_CLIENT_SECRET, 'private maintenance control required');
  for (const key of ['DALI_ORIGIN', 'DALI_OIDC_ISSUER']) { const u = new URL(f.config[key]); assert(u.protocol === 'https:' && f.hostLookup[u.hostname] === '127.0.0.1', 'loopback verified HTTPS required'); }
}
export function validateReport(r) {
  assert.equal(r.scope, 'local-shared-host-and-volume'); assert.equal(r.productionAccepted, false);
  for (const k of ['restartMs', 'maintenanceMs', 'restoreToUsableMs', 'backupPublicationMs', 'recoveryPointAgeMs', 'acknowledgedLossMs']) assert(Number.isFinite(r[k]) && r[k] >= 0, 'measured timing required');
  assert(r.recoveryPointAgeMs <= 3600000 && r.acknowledgedLossMs <= 3600000, 'local RPO budget');
  assert(r.restoreToUsableMs <= 86400000 && r.maintenanceMs <= 86400000, 'local RTO/maintenance budget');
  assert(r.boards === 50 && r.images >= 50 && r.imageBytes >= 128 * 1024 * 1024, 'representative envelope');
  assert(r.backupBytes > 0 && r.capacity30DaysWith25PercentHeadroom >= r.backupBytes, 'measured capacity');
  for (const k of ['coldHashesVerified', 'rolesVerified', 'sessionInvalidationVerified', 'epochChanged', 'revocationReconciled', 'backupResumed', 'writerFenced', 'rollbackVerified']) assert.equal(r[k], true, 'required runtime evidence');
}
async function selfTest() {
  assert.throws(() => parseOptions([]), /explicit local/);
  assert.throws(() => parseOptions(['--local', '--synthetic', '--context', 'production']), /explicit local/);
  assert.throws(() => validateLocalFixture({ synthetic: true, disposable: true, validationScope: 'production' }), /local synthetic/);
  assert.throws(() => validateReport({ scope: 'local-shared-host-and-volume', productionAccepted: false }), /timing/);
  assert.throws(() => validateReport({ scope: 'independent-production', productionAccepted: true }));
  const measured = { scope: 'local-shared-host-and-volume', productionAccepted: false,
    restartMs: 1, maintenanceMs: 1, restoreToUsableMs: 1, backupPublicationMs: 1, recoveryPointAgeMs: 1, acknowledgedLossMs: 1,
    boards: 50, images: 50, imageBytes: 128 * 1024 * 1024, backupBytes: 1, capacity30DaysWith25PercentHeadroom: 3602,
    coldHashesVerified: true, rolesVerified: true, sessionInvalidationVerified: true, epochChanged: true,
    revocationReconciled: true, backupResumed: true, writerFenced: true, rollbackVerified: true };
  validateReport(measured);
  for (const key of ['coldHashesVerified', 'rolesVerified', 'sessionInvalidationVerified', 'epochChanged', 'revocationReconciled', 'backupResumed', 'writerFenced', 'rollbackVerified']) {
    assert.throws(() => validateReport({ ...measured, [key]: false }), /runtime evidence/);
  }
  for (const key of ['recoveryPointAgeMs', 'acknowledgedLossMs']) assert.throws(() => validateReport({ ...measured, [key]: 3600001 }), /RPO/);
  for (const key of ['restoreToUsableMs', 'maintenanceMs']) assert.throws(() => validateReport({ ...measured, [key]: 86400001 }), /RTO/);
  console.log('LOCAL_RECOVERY_CONTRACTS_PASS');
}

export async function runRecoveryDrill(args) {
  const o = parseOptions(args); const f = JSON.parse(await readFile(o['--fixture'], 'utf8')); validateLocalFixture(f);
  const reportPath = resolve(o['--report']);
  assert(!(await realpath(dirname(reportPath))).startsWith(root), 'private report directory required');
  const ns = o['--namespace']; const id = randomUUID();
  const kubectl = async (...argv) => (await run('kubectl', ['--context', o['--context'], '--namespace', ns, '--request-timeout=30s', ...argv], { timeout: 360000, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
  const resource = async (kind, name) => JSON.parse(await kubectl('get', kind, name, '-o', 'json'));
  const appExec = async code => JSON.parse(await kubectl('exec', 'deployment/dali', '-c', 'app', '--', 'node', '--input-type=module', '-e', code));
  const patch = async (kind, name, value) => kubectl('patch', kind, name, '--type=json', '-p', JSON.stringify(value));
  gate = 'synthetic ownership and storage identity';
  const namespace = await resource('namespace', ns); assert(namespace.metadata.labels['dali.example.org/smoke-owner'], 'owned smoke namespace required');
  const deployment = await resource('deployment', 'dali'); assert.equal(deployment.spec.replicas, 1); assert.equal(deployment.spec.strategy.type, 'Recreate');
  const originalImages = deployment.spec.template.spec.containers.map(c => ({ name: c.name, image: c.image }));
  const appIndex = deployment.spec.template.spec.containers.findIndex(c => c.name === 'app');
  const databaseIndex = deployment.spec.template.spec.containers[appIndex].env.findIndex(e => e.name === 'DALI_DATABASE_PATH');
  assert.equal(deployment.spec.template.spec.containers[appIndex].env[databaseIndex].value, '/data/boards.sqlite', 'fresh original live target required');
  const claims = await Promise.all(['dali-live', 'dali-backup'].map(n => resource('pvc', n)));
  const volumes = await Promise.all(claims.map(c => resource('pv', c.spec.volumeName)));
  for (const [index, pv] of volumes.entries()) {
    assert.equal(pv.spec.claimRef.uid, claims[index].metadata.uid); assert.equal(pv.spec.claimRef.namespace, ns);
    assert.deepEqual(pv.spec.accessModes, ['ReadWriteOnce']); assert.equal(pv.spec.local.path, index ? '/var/local/dali-backup' : '/var/local/dali-live');
  }
  assert.notEqual(volumes[0].metadata.uid, volumes[1].metadata.uid);
  const origin = new URL(f.config.DALI_ORIGIN).origin; const issuer = new URL(f.config.DALI_OIDC_ISSUER).origin;
  const ca = await readFile(f.caFile); const secret = f.auth.DALI_OIDC_CLIENT_SECRET;
  const request = (url, { method = 'GET', body, headers = {}, validation = true } = {}) => new Promise((resolve, reject) => {
    url = new URL(url, origin); assert([origin, issuer].includes(url.origin), 'allowed fixture endpoint');
    const lookup = (hostname, options, done) => { const address = f.hostLookup[hostname]; if (address !== '127.0.0.1') return done(new Error('Unmapped host')); done(null, options.all ? [{ address, family: 4 }] : address, 4); };
    const req = https.request(url, { ca, lookup, method, headers: { ...headers, ...(validation && url.origin === origin ? { 'x-dali-fixture-validation': secret } : {}), ...(body ? { 'content-length': body.length } : {}) } }, res => {
      const chunks = []; let size = 0; res.on('data', b => { size += b.length; if (size > 32 * 1024 * 1024) req.destroy(new Error('Response limit')); else chunks.push(b); }); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    }); req.on('error', reject); req.setTimeout(30000, () => req.destroy(new Error('HTTPS timeout'))); req.end(body);
  });
  const status = (r, expected = 200) => { assert.equal(r.status, expected, 'authenticated API status'); return r; };
  const json = r => JSON.parse(r.bytes.toString());
  const control = async closed => { status(await request(issuer + '/fixture/maintenance?mode=' + (closed ? 'closed' : 'open'), { method: 'POST', headers: { 'x-fixture-secret': secret } })); if (closed) status(await request('/', { validation: false }), 503); };
  async function actor(identity, denied = false) {
    let cookie = '';
    const send = async (path, options = {}) => { const r = await request(path, { ...options, headers: { ...(cookie ? { cookie } : {}), ...options.headers } }); if (new URL(path, origin).origin === origin && r.headers['set-cookie']) cookie = r.headers['set-cookie'].at(-1).split(';')[0]; return r; };
    const begin = status(await send('/auth/start'), 302); const authorization = new URL(begin.headers.location); assert.equal(authorization.origin, issuer); authorization.searchParams.set('login_hint', identity);
    const authorized = status(await request(authorization.href), 302); assert.equal(new URL(authorized.headers.location).origin, origin);
    const callback = await send(authorized.headers.location);
    if (denied) { assert([302, 403].includes(callback.status)); status(await send('/api/session'), 401); return; }
    status(callback, 302); const session = json(status(await send('/api/session')));
    const headers = { origin, 'x-dali-request': '1', 'x-dali-account': session.accountId };
    const epoch = json(status(await send('/api/recovery-state', { headers }))).epoch; headers['x-dali-recovery-epoch'] = epoch;
    const api = (path, method = 'GET', body, type = 'application/json', extra = {}) => send(path, { method, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)), headers: { ...headers, 'content-type': type, ...extra } });
    return { api, send, session, epoch, cookie: () => cookie };
  }
  const identities = ['owner', 'editor', 'viewer'];
  let actors = await Promise.all(identities.map(i => actor(i)));
  const health = async a => { for (let n = 0; n < 90; n++) { const h = json(status(await a.api('/api/storage-health'))).backup; if (h.state === 'healthy') return h; await pause(1000); } throw new Error('Backup did not resume'); };
  await health(actors[0]);
  gate = 'representative signed API dataset'; console.log('LOCAL_RECOVERY_PROGRESS stage=representative signed API dataset');
  const { createRecoveryDataset, recoveryImage, populateRecoveryDocument, sha256 } = await import('../server/testing/recovery-dataset.ts');
  const manifest = createRecoveryDataset(415); const boards = []; const expected = [];
  if (o['--resume-seed']) {
    const saved = JSON.parse(await readFile(reportPath + '.state.json', 'utf8'));
    assert.equal(saved.scope, 'synthetic-private-runtime'); assert.equal(saved.origin, origin);
    assert.deepEqual(saved.manifest, manifest, 'exact checkpoint dataset');
    assert.equal(saved.boards.length, manifest.boards); assert.equal(saved.expected.length, manifest.boards);
    for (const b of saved.boards) assert(/^[a-zA-Z0-9_-]+$/.test(b.summary.id), 'checkpoint board identity');
    boards.push(...saved.boards); expected.push(...saved.expected);
    console.log('LOCAL_RECOVERY_PROGRESS resumed-seed=50');
  }
  for (const spec of o['--resume-seed'] ? [] : manifest.boardSpecs) {
    const a = actors[spec.owner]; const board = json(status(await a.api('/api/boards', 'POST', { operationId: randomUUID(), title: `Synthetic cluster recovery ${spec.index}` }), 201)); boards.push(board);
    const base = '/api/boards/' + board.summary.id;
    if (spec.shared) for (const offset of [1, 2]) { const state = json(status(await a.api(base + '/grants'))); status(await a.api(base + '/grants', 'POST', { operationId: randomUUID(), revision: state.revision, memberId: actors[(spec.owner + offset) % 3].session.accountId, role: offset === 1 ? 'editor' : 'viewer' })); }
    for (const index of spec.imageIndexes) { const image = recoveryImage(manifest.seed, index); status(await a.api(base + '/blobs/' + image.key, 'PUT', image.bytes, 'image/png')); }
    const path = base + '/docs/' + board.contentDocId;
    const initial = status(await a.api(path + '/pull', 'POST', Buffer.from([0]), 'application/octet-stream')).bytes;
    const update = populateRecoveryDocument(initial, spec, manifest); assert.equal(json(status(await a.api(path + '/push', 'POST', update, 'application/octet-stream'))).acknowledged, true);
    const documents = {};
    for (const doc of [board.rootDocId, board.contentDocId]) documents[doc] = sha256(status(await a.api(base + '/docs/' + doc + '/pull', 'POST', Buffer.from([0]), 'application/octet-stream')).bytes);
    expected.push({ documents, boardId: board.summary.id });
    if ((spec.index + 1) % 10 === 0) console.log('LOCAL_RECOVERY_PROGRESS seeded=' + (spec.index + 1));
  }
  await writeFile(reportPath + '.state.json', JSON.stringify({ manifest, boards, expected, origin, scope: 'synthetic-private-runtime' }), { mode: 0o600 });
  const coldVerify = async (revoked = false) => {
    actors = await Promise.all(identities.map(i => actor(i)));
    for (const [actorIndex, a] of actors.entries()) for (const [index, board] of boards.entries()) {
      const spec = manifest.boardSpecs[index]; const permitted = (spec.shared || spec.owner === actorIndex) && !(revoked && index === 0 && actorIndex === 1);
      const base = '/api/boards/' + board.summary.id; const result = await a.api(base); status(result, permitted ? 200 : 404);
      if (!permitted) { for (const imageIndex of spec.imageIndexes) status(await a.api(base + '/blobs/' + manifest.imageSpecs[imageIndex].key), 404); continue; }
      assert.equal(json(result).summary.role, actorIndex === spec.owner ? 'owner' : actorIndex === (spec.owner + 1) % 3 ? 'editor' : 'viewer');
      for (const [doc, hash] of Object.entries(expected[index].documents)) assert.equal(sha256(status(await a.api(base + '/docs/' + doc + '/pull', 'POST', Buffer.from([0]), 'application/octet-stream')).bytes), hash, 'cold document hash');
      for (const imageIndex of spec.imageIndexes) { const image = manifest.imageSpecs[imageIndex]; assert.equal(sha256(status(await a.api(base + '/blobs/' + image.key)).bytes), image.sha256, 'cold image hash'); }
    }
    await health(actors[0]);
    // Use shared board 2 so the separately reconciled board-0 revocation does not obscure role checks.
    const b = boards[2]; for (const [index, a] of actors.entries()) status(await a.api('/api/boards/' + b.summary.id + '/docs/' + b.contentDocId + '/push', 'POST', Buffer.from([0, 0]), 'application/octet-stream'), index === 1 ? 403 : 200);
    await actor('denied', true);
  };
  const pods = async () => JSON.parse(await kubectl('get', 'pods', '-l', 'app=dali', '-o', 'json')).items;
  const stop = async () => { const old = await pods(); assert.equal(old.length, 1, 'one live writer'); await kubectl('scale', 'deployment/dali', '--replicas=0'); await kubectl('wait', '--for=delete', 'pod/' + old[0].metadata.name, '--timeout=120s'); assert.equal((await pods()).length, 0, 'old writer terminated'); return old[0].metadata.uid; };
  const start = async old => { await kubectl('scale', 'deployment/dali', '--replicas=1'); await kubectl('rollout', 'status', 'deployment/dali', '--timeout=300s'); const current = await pods(); assert.equal(current.length, 1); assert.notEqual(current[0].metadata.uid, old); return current[0].status.containerStatuses.map(c => ({ name: c.name, imageID: c.imageID })); };
  const images = [];
  gate = 'normal fenced restart'; console.log('LOCAL_RECOVERY_PROGRESS stage=normal fenced restart'); let began = performance.now(); const originalEpoch = actors[0].epoch; await control(true); let old = await stop(); images.push({ stage: 'current', containers: await start(old) }); await coldVerify(); assert.equal(actors[0].epoch, originalEpoch); await control(false); const restartMs = performance.now() - began;
  gate = 'compatible rollback maintenance'; console.log('LOCAL_RECOVERY_PROGRESS stage=compatible rollback maintenance'); began = performance.now(); await control(true); old = await stop();
  await kubectl('set', 'image', 'deployment/dali', 'app=' + o['--rollback-app-image'], 'web=' + o['--rollback-web-image']); images.push({ stage: 'rollback', containers: await start(old) }); await coldVerify(); assert.equal(actors[0].epoch, originalEpoch);
  old = await stop(); await kubectl('set', 'image', 'deployment/dali', ...originalImages.map(c => c.name + '=' + c.image)); images.push({ stage: 'current-again', containers: await start(old) }); await coldVerify(); await control(false); const maintenanceMs = performance.now() - began;
  gate = 'measured acknowledged canaries and selected backup'; console.log('LOCAL_RECOVERY_PROGRESS stage=measured acknowledged canaries and selected backup');
  const canaries = []; const canaryBoard = boards[0]; const base = '/api/boards/' + canaryBoard.summary.id;
  const canary = async () => { const state = json(status(await actors[0].api(base))); const submittedAt = Date.now(); const title = 'Synthetic canary ' + canaries.length + ' at ' + submittedAt; status(await actors[0].api(base, 'PATCH', { operationId: randomUUID(), title, revision: state.revision })); canaries.push({ title, submittedAt, acknowledgedAt: Date.now() }); };
  await canary(); let running = true; const loop = (async () => { while (running && canaries.length < 20) { await pause(100); if (running) await canary(); } })();
  let selected; const backupBegan = performance.now();
  try { selected = await appExec("import Database from 'better-sqlite3';import {publishBackup,backupDigest} from './server/storage/backup.js';const d=new Database('/data/boards.sqlite',{readonly:true,fileMustExist:true});try{const s=await publishBackup({database:d,destination:{directory:'/backups',independentStorage:true},applicationVersion:'0.1.0'});console.log(JSON.stringify({...s,manifestDigest:await backupDigest('/backups/'+s.id+'/manifest.json')}))}finally{d.close()}"); }
  finally { running = false; await loop; }
  const backupPublicationMs = performance.now() - backupBegan; await canary();
  const selectedTitle = await appExec("import Database from 'better-sqlite3';const d=new Database(" + JSON.stringify('/backups/' + selected.id + '/database.sqlite') + ",{readonly:true,fileMustExist:true});console.log(JSON.stringify(d.prepare('SELECT title FROM boards WHERE id=?').get(" + JSON.stringify(canaryBoard.summary.id) + ").title));d.close()");
  const included = canaries.find(c => c.title === selectedTitle); assert(included, 'selected backup must include acknowledged canary');
  // Record and revoke one post-point grant; reconcile this security change before reopening.
  const grantState = json(status(await actors[0].api(base + '/grants'))); const revoke = grantState.grants.find(g => g.memberId === actors[1].session.accountId); assert(revoke);
  status(await actors[0].api(base + '/grants/' + revoke.id, 'DELETE', { operationId: randomUUID(), revision: revoke.revision })); status(await actors[1].api(base), 404);
  const oldCookie = actors[0].cookie(); const oldEpoch = actors[0].epoch; const revokedMember = actors[1].session.accountId;
  const incidentAt = Date.now(); const recoveryBegan = performance.now(); await control(true); old = await stop();
  gate = 'offline selected backup verification and fresh target recovery'; console.log('LOCAL_RECOVERY_PROGRESS stage=offline selected backup verification and fresh target recovery');
  const helper = 'dali-recovery-' + id.slice(0, 8); const helperManifest = { apiVersion: 'v1', kind: 'Pod', metadata: { name: helper, namespace: ns, labels: { 'dali.example.org/recovery-owner': id } }, spec: { restartPolicy: 'Never', automountServiceAccountToken: false,
    containers: [{ name: 'operator', image: originalImages.find(c => c.name === 'app').image, imagePullPolicy: 'IfNotPresent', command: ['node', '-e', 'setInterval(()=>{},1000)'], securityContext: { runAsUser: 1000, runAsGroup: 1000, runAsNonRoot: true, readOnlyRootFilesystem: true, allowPrivilegeEscalation: false, capabilities: { drop: ['ALL'] }, seccompProfile: { type: 'RuntimeDefault' } }, volumeMounts: [{ name: 'live', mountPath: '/data' }, { name: 'backup', mountPath: '/backups' }] }], volumes: [{ name: 'live', persistentVolumeClaim: { claimName: 'dali-live' } }, { name: 'backup', persistentVolumeClaim: { claimName: 'dali-backup' } }] } };
  const helperFile = reportPath + '.operator.json'; await writeFile(helperFile, JSON.stringify(helperManifest), { mode: 0o600 }); await kubectl('create', '-f', helperFile); await kubectl('wait', '--for=condition=Ready', 'pod/' + helper, '--timeout=120s');
  const operator = async (...argv) => JSON.parse(await kubectl('exec', helper, '--', 'node', 'server/operator.js', ...argv));
  const helperExec = async code => JSON.parse(await kubectl('exec', helper, '--', 'node', '--input-type=module', '-e', code));
  const backupPath = '/backups/' + selected.id; const destination = '/data/recovered-' + id;
  await operator('inspect', '--backup', backupPath, '--expected-manifest-digest', selected.manifestDigest);
  assert.equal((await pods()).length, 0); assert.equal((await resource('deployment', 'dali')).spec.replicas, 0);
  // Unlink only the three explicitly selected original SQLite companions on the owned live claim.
  await helperExec("import fs from 'node:fs';for(const n of ['boards.sqlite','boards.sqlite-wal','boards.sqlite-shm']){const p='/data/'+n;if(fs.existsSync(p)){if(!fs.lstatSync(p).isFile())throw Error('Unexpected live target');fs.unlinkSync(p)}}fs.mkdirSync(" + JSON.stringify(destination) + ",{mode:0o700});console.log(JSON.stringify({syntheticLiveFilesRemoved:true}))");
  const restored = await operator('restore', '--backup', backupPath, '--destination', destination, '--source-database', '/data/boards.sqlite', '--maintenance-confirmed', '--writer-fenced', 'writer-stopped', '--fence-evidence', 'Observed replicas zero and original pod UID terminated in owned synthetic namespace', '--expected-manifest-digest', selected.manifestDigest);
  await operator('verify', '--destination', destination); assert.notEqual(restored.epoch, oldEpoch); assert.equal(restored.sessionsInvalidated, true);
  // Apply the explicit host-held post-point revocation while ingress is closed and writer remains stopped.
  await helperExec("import Database from 'better-sqlite3';const d=new Database(" + JSON.stringify(destination + '/database.sqlite') + ",{fileMustExist:true});d.prepare('DELETE FROM board_grants WHERE board_id=? AND member_id=?').run(" + JSON.stringify(canaryBoard.summary.id) + "," + JSON.stringify(revokedMember) + ");d.close();console.log(JSON.stringify({reconciled:true}))");
  await kubectl('delete', 'pod/' + helper, '--wait=true', '--timeout=120s');
  await patch('deployment', 'dali', [{ op: 'replace', path: '/spec/template/spec/containers/' + appIndex + '/env/' + databaseIndex + '/value', value: destination + '/database.sqlite' }]);
  images.push({ stage: 'restored', containers: await start(old) });
  gate = 'cold restored authentication permissions hashes and fresh backup'; console.log('LOCAL_RECOVERY_PROGRESS stage=cold restored authentication permissions hashes and fresh backup');
  status(await request('/api/session', { headers: { cookie: oldCookie } }), 401);
  await coldVerify(true); assert.notEqual(actors[0].epoch, oldEpoch);
  status(await actors[0].api('/api/boards', 'POST', { operationId: randomUUID(), title: 'Synthetic stale epoch' }, 'application/json', { 'x-dali-recovery-epoch': oldEpoch }), 409);
  assert.equal(json(status(await actors[0].api(base))).summary.title, selectedTitle);
  const resumed = await health(actors[0]); assert(resumed.recoveryPointAt >= restored.restoredAt, 'fresh restored epoch backup');
  await control(false); status(await request('/health/ready', { validation: false }));
  const report = { schema: 1, scope: 'local-shared-host-and-volume', productionAccepted: false, seed: manifest.seed, boards: manifest.boards, images: manifest.images, imageBytes: manifest.imageBytes,
    restartMs, maintenanceMs, restoreToUsableMs: performance.now() - recoveryBegan, backupPublicationMs, recoveryPointAgeMs: incidentAt - selected.manifest.recoveryPointAt,
    acknowledgedLossMs: canaries.at(-1).acknowledgedAt - included.acknowledgedAt, acknowledgedCanaries: canaries.length, restoredCanaryIndex: canaries.indexOf(included), backupBytes: selected.manifest.byteLength,
    capacity30DaysWith25PercentHeadroom: Math.ceil(selected.manifest.byteLength * (30 * 24 * 4 + 1) * 1.25), backupCadenceMs: 900000,
    coldHashesVerified: true, rolesVerified: true, sessionInvalidationVerified: true, epochChanged: true, revocationReconciled: true, backupResumed: true, writerFenced: true, rollbackVerified: true,
    storageLoss: 'selected original SQLite files only; separate PV directories share Docker volume and host', browserRenderingVerified: false, imageRevisions: images,
    selectedManifestDigest: selected.manifestDigest, selectedBackupId: selected.id, selectedRecoveryPointAt: selected.manifest.recoveryPointAt };
  validateReport(report); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log('LOCAL_RECOVERY_DRILL_PASS'); return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.includes('--self-test')) await selfTest(); else await runRecoveryDrill(process.argv.slice(2)); }
  catch { console.error('RECOVERY_DRILL_FAILED: ' + gate + '; owned resources retained; inspect private evidence before recovery'); process.exitCode = 1; }
}
