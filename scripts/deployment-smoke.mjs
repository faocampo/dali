#!/usr/bin/env node
/** Static evidence and real disposable-cluster acceptance have separate success markers. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import https from 'node:https';
import { isIP } from 'node:net';
import { crc32, deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const load = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const get = (rs, kind, name) => rs.find(r => r.kind === kind && (!name || r.metadata.name === name));
let gate = 'arguments and synthetic prerequisites';

export function validateResources(rs, { local = false } = {}) {
  const deployments = rs.filter(r => r.kind === 'Deployment');
  assert.equal(deployments.length, 1, 'single writer Deployment');
  const d = deployments[0];
  assert.equal(d.spec.replicas, 1, 'single writer replicas');
  assert.equal(d.spec.strategy.type, 'Recreate', 'single writer replacement');
  const p = d.spec.template.spec;
  assert.equal(p.automountServiceAccountToken, false, 'service token disabled');
  assert.equal(p.terminationGracePeriodSeconds, 60, 'drain grace');
  assert(!p.hostNetwork && !p.hostPID && !p.hostIPC && !p.initContainers?.length, 'private pod');
  assert.equal(p.containers.length, 2, 'only app/web containers');
  for (const [name, uid] of [['app', 1000], ['web', 101]]) {
    const c = p.containers.find(c => c.name === name); assert(c, name + ' required');
    const s = c.securityContext;
    assert(s.runAsNonRoot && s.runAsUser === uid && s.runAsGroup === uid && s.readOnlyRootFilesystem, 'restricted identity/rootfs');
    assert.equal(s.allowPrivilegeEscalation, false, 'escalation disabled');
    assert.deepEqual(s.capabilities, { drop: ['ALL'] }, 'capabilities');
    assert.equal(s.seccompProfile.type, 'RuntimeDefault', 'seccomp');
    assert(!s.privileged && !c.ports?.some(x => x.hostPort), 'private unprivileged container');
    for (const type of ['startupProbe', 'readinessProbe', 'livenessProbe']) assert(c[type], 'missing probes');
    for (const type of ['requests', 'limits']) assert(c.resources[type].cpu && c.resources[type].memory, 'resources');
    assert(c.volumeMounts.some(m => m.mountPath === '/tmp'), 'missing temp mount');
  }
  const app = p.containers.find(c => c.name === 'app');
  assert(app.envFrom.some(e => e.configMapRef?.name === 'dali-config'), 'external config');
  assert(app.envFrom.some(e => e.secretRef?.name === 'dali-auth'), 'external secret');
  assert(!app.env.some(e => /SECRET/.test(e.name) && e.value), 'inline secrets');
  for (const [name, path, claim] of [['live', '/data', 'dali-live'], ['backup', '/backups', 'dali-backup']]) {
    assert(app.volumeMounts.some(m => m.name === name && m.mountPath === path && !m.readOnly), 'missing persistent mount');
    assert(p.volumes.some(v => v.name === name && v.persistentVolumeClaim?.claimName === claim), 'persistent claim');
    assert.deepEqual(get(rs, 'PersistentVolumeClaim', claim)?.spec.accessModes, [local ? 'ReadWriteOnce' : 'ReadWriteOncePod'], 'single pod storage');
  }
  const service = get(rs, 'Service'); assert(service, 'service');
  assert.equal(service.spec.type, 'ClusterIP', 'private service');
  assert(!service.spec.externalIPs?.length, 'private service');
  assert.deepEqual(service.spec.ports, [{ name: 'http', port: 8080, targetPort: 'http' }], 'only proxy exposed');
  const n = get(rs, 'NetworkPolicy'); assert(n, 'network boundary');
  assert.deepEqual(n.spec.podSelector, { matchLabels: { app: 'dali' } }, 'selected pods');
  assert.deepEqual(n.spec.policyTypes, ['Ingress', 'Egress'], 'network boundary');
  assert(n.spec.ingress.length && n.spec.egress.length, 'explicit network bindings');
  for (const rule of n.spec.ingress) {
    assert(rule.from?.length && rule.ports?.length && rule.ports.every(p => p.port === 8080 && p.protocol === 'TCP'), 'ingress boundary');
    for (const peer of rule.from) assert(Object.keys(peer.namespaceSelector?.matchLabels ?? {}).length && Object.keys(peer.podSelector?.matchLabels ?? {}).length, 'ingress peer binding');
  }
  for (const rule of n.spec.egress) {
    assert(rule.to?.length && rule.ports?.length, 'egress boundary');
    for (const peer of rule.to) assert((Object.keys(peer.namespaceSelector?.matchLabels ?? {}).length && Object.keys(peer.podSelector?.matchLabels ?? {}).length) || (peer.ipBlock?.cidr && !['0.0.0.0/0', '::/0'].includes(peer.ipBlock.cidr)), 'egress peer binding');
  }
  const ingress = get(rs, 'Ingress'); assert(ingress, 'TLS ingress');
  assert(ingress.spec.ingressClassName, 'selected ingress class');
  assert.equal(ingress.spec.tls[0].secretName, 'dali-tls', 'external TLS');
  assert.deepEqual(ingress.spec.tls[0].hosts, ingress.spec.rules.map(r => r.host), 'TLS hosts');
  assert.equal(ingress.metadata.annotations['nginx.ingress.kubernetes.io/force-ssl-redirect'], 'true', 'HTTPS redirect');
  return rs;
}

async function resources(exampleOverlay = false) {
  const k = await load('deploy/kubernetes/base/kustomization.yaml'); const rs = [];
  for (const path of k.resources) {
    assert(!path.includes('..'), 'local base resource');
    const value = await load('deploy/kubernetes/base/' + path);
    rs.push(...(value.kind === 'List' ? value.items : [value]));
  }
  rs.push(await load('deploy/kubernetes/overlays/example/ingress.yaml'));
  if (exampleOverlay) {
    const overlay = await load('deploy/kubernetes/overlays/example/kustomization.yaml');
    for (const patch of overlay.patches) {
      const target = get(rs, patch.target.kind, patch.target.name); assert(target, 'overlay target');
      for (const op of JSON.parse(patch.patch)) {
        assert.equal(op.op, 'replace', 'supported example overlay operation');
        const parts = op.path.split('/').slice(1).map(p => p.replaceAll('~1', '/').replaceAll('~0', '~'));
        const field = parts.pop(); const parent = parts.reduce((v, p) => v[p], target);
        assert(Object.hasOwn(parent, field), 'existing overlay field'); parent[field] = op.value;
      }
    }
    for (const image of overlay.images) {
      const c = get(rs, 'Deployment').spec.template.spec.containers.find(c => c.image.split(':')[0] === image.name);
      assert(c, 'overlay image'); c.image = image.newName + ':' + image.newTag;
    }
  }
  return rs;
}

function argumentsForRuntime(args) {
  const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const context = option('--context');
  assert(context && !context.startsWith('-') && context !== 'default', 'explicit disposable context required');
  const namespace = option('--namespace');
  assert(/^dali-smoke-[a-z0-9][a-z0-9-]{0,40}$/.test(namespace ?? ''), 'fresh dali-smoke namespace required');
  const appImage = option('--app-image'); const webImage = option('--web-image');
  assert(appImage && webImage && ![appImage, webImage].some(x => x.startsWith('-')), 'explicit built images required');
  assert(option('--fixture'), 'external synthetic fixture file required');
  return { context, namespace, appImage, webImage, fixture: option('--fixture'), local: args.includes('--local') };
}

function validateFixture(f, local = false) {
  assert.equal(f.synthetic, true, 'synthetic fixture declaration required');
  assert.equal(f.disposable, true, 'disposable environment declaration required');
  assert.equal(f.validationScope === 'local', local, 'local scope requires explicit --local and cannot establish production acceptance');
  assert.equal(f.storageSemanticsVerified, true, 'storage locking/fsync and mode-0700 UID-1000 roots required');
  if (local) {
    assert.equal(f.independentBackupVerified, false, 'local host independence must remain unverified');
    assert.equal(f.liveStorageLossIsolationVerified, true, 'local live-volume loss isolation required');
    assert.equal(f.singleWriterFencingVerified, true, 'local single-writer fencing required');
    assert.equal(f.storageAccessMode, 'ReadWriteOnce', 'local RWO contract');
    assert.equal(f.ingressMode, 'synthetic-https-proxy', 'local HTTPS fixture contract');
  } else {
    assert.equal(f.independentBackupVerified, true, 'independent backup destination required');
    assert(!f.hostLookup && !f.hostAliases, 'local host mappings require local scope');
  }
  const origin = new URL(f.config.DALI_ORIGIN); const issuer = new URL(f.config.DALI_OIDC_ISSUER);
  for (const u of [origin, issuer]) assert(u.protocol === 'https:' && !u.username && !u.password && !u.hash && !u.search, 'verified HTTPS fixture');
  assert.equal(origin.href, origin.origin + '/', 'canonical origin');
  assert.equal(f.config.DALI_OIDC_CALLBACK_URL, origin.origin + '/auth/callback', 'canonical callback');
  assert.equal(f.config.DALI_BACKUP_INDEPENDENT_STORAGE, 'true', 'independent backup configuration');
  assert(f.auth.DALI_SESSION_SECRET?.length >= 32 && f.auth.DALI_OIDC_CLIENT_SECRET, 'external auth secrets');
  assert(f.tls?.['tls.crt'] && f.tls?.['tls.key'] && f.caFile, 'TLS fixture and trust required');
  assert(f.liveStorageClass && f.backupStorageClass && f.ingressClass && f.networkPolicy, 'operator bindings required');
  if (local) {
    assert(f.hostLookup && Object.keys(f.hostLookup).length === 2, 'local loopback host mappings required');
    for (const u of [origin, issuer]) assert.equal(f.hostLookup[u.hostname], '127.0.0.1', 'local loopback mapping required');
    assert(Array.isArray(f.hostAliases) && f.hostAliases.length === 1, 'exact issuer pod host mapping required');
    assert(isIP(f.hostAliases[0].ip) === 4, 'issuer Service IPv4 required');
    assert.deepEqual(f.hostAliases[0].hostnames, [issuer.hostname], 'only issuer pod host mapping permitted');
  }
  return f;
}

async function selfTest() {
  const valid = await resources();
  await test('accepts restricted manifests', () => validateResources(valid));
  for (const [name, mutate, pattern] of [
    ['rejects multiple writers', r => { get(r, 'Deployment').spec.replicas = 2; }, /single writer/],
    ['rejects insecure exposure', r => { get(r, 'Service').spec.type = 'NodePort'; }, /private service/],
    ['rejects missing persistent mount', r => { get(r, 'Deployment').spec.template.spec.containers[0].volumeMounts.shift(); }, /missing persistent mount/],
    ['rejects missing probes', r => { delete get(r, 'Deployment').spec.template.spec.containers[0].readinessProbe; }, /missing probes/],
    ['rejects missing TLS', r => { r.splice(r.findIndex(x => x.kind === 'Ingress'), 1); }, /TLS ingress/],
    ['rejects unrestricted egress', r => { get(r, 'NetworkPolicy').spec.egress = [{}]; }, /egress boundary/],
    ['rejects elevated container', r => { get(r, 'Deployment').spec.template.spec.containers[0].securityContext.privileged = true; }, /unprivileged/],
  ]) await test(name, () => {
    const value = structuredClone(valid); mutate(value); assert.throws(() => validateResources(value), pattern);
  });
  await test('rejects missing explicit context', () => assert.throws(() => argumentsForRuntime([]), /explicit disposable context/));
  await test('rejects default context', () => assert.throws(() => argumentsForRuntime(['--context', 'default']), /explicit disposable context/));
  await test('rejects nonsynthetic fixture', () => assert.throws(() => validateFixture({ synthetic: false }), /synthetic fixture/));
  const localFixture = {
    synthetic: true, disposable: true, validationScope: 'local', storageSemanticsVerified: true,
    independentBackupVerified: false, liveStorageLossIsolationVerified: true,
    singleWriterFencingVerified: true, storageAccessMode: 'ReadWriteOnce', ingressMode: 'synthetic-https-proxy',
    config: { DALI_ORIGIN: 'https://app.dali.test:19443', DALI_OIDC_ISSUER: 'https://oidc.dali.test:19444',
      DALI_OIDC_CALLBACK_URL: 'https://app.dali.test:19443/auth/callback', DALI_BACKUP_INDEPENDENT_STORAGE: 'true' },
    auth: { DALI_SESSION_SECRET: 'x'.repeat(32), DALI_OIDC_CLIENT_SECRET: 'synthetic' },
    tls: { 'tls.crt': 'synthetic', 'tls.key': 'synthetic' }, caFile: 'synthetic',
    liveStorageClass: 'local-live', backupStorageClass: 'local-backup', ingressClass: 'synthetic', networkPolicy: {},
    hostLookup: { 'app.dali.test': '127.0.0.1', 'oidc.dali.test': '127.0.0.1' },
    hostAliases: [{ ip: '10.96.0.2', hostnames: ['oidc.dali.test'] }],
  };
  await test('accepts explicitly local scoped storage evidence', () => validateFixture(localFixture, true));
  await test('rejects local evidence for production acceptance', () => assert.throws(() => validateFixture(localFixture), /local scope/));
  await test('rejects local storage without live-loss isolation', () => assert.throws(() => validateFixture({ ...localFixture, liveStorageLossIsolationVerified: false }, true), /live-volume loss/));
  await test('rejects local DNS mapping to external addresses', () => assert.throws(() => validateFixture({ ...localFixture, hostLookup: { 'app.dali.test': '203.0.113.1' } }, true), /loopback/));
  await test('accepts RWO only in explicit local manifest validation', () => {
    const value = structuredClone(valid);
    for (const claim of value.filter(r => r.kind === 'PersistentVolumeClaim')) claim.spec.accessModes = ['ReadWriteOnce'];
    validateResources(value, { local: true });
    assert.throws(() => validateResources(value), /single pod storage/);
  });
}

// Host-held expected bytes are never supplied to the replacement pod.
async function client(f) {
  const ca = await readFile(f.caFile); const origin = new URL(f.config.DALI_ORIGIN).origin;
  const issuer = new URL(f.config.DALI_OIDC_ISSUER).origin; let cookie = '';
  const request = (path, method = 'GET', body, headers = {}) => new Promise((resolve, reject) => {
    const url = new URL(path, origin); assert([origin, issuer].includes(url.origin), 'fixture redirect origin');
    const lookup = f.validationScope === 'local' ? (hostname, options, callback) => {
      const address = f.hostLookup[hostname];
      if (address !== '127.0.0.1') return callback(new Error('Unmapped local fixture host'));
      callback(null, options.all ? [{ address, family: 4 }] : address, 4);
    } : undefined;
    const req = https.request(url, { ca, lookup, method, headers: { ...(cookie && url.origin === origin ? { cookie } : {}), ...headers, ...(body ? { 'content-length': body.length } : {}) } }, response => {
      if (url.origin === origin && response.headers['set-cookie']) cookie = response.headers['set-cookie'].at(-1).split(';')[0];
      const chunks = []; let size = 0;
      response.on('data', b => { size += b.length; if (size > 32 * 1024 * 1024) req.destroy(new Error('Response limit')); else chunks.push(b); });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.setTimeout(15000, () => req.destroy(new Error('HTTPS deadline'))); req.end(body);
  });
  const check = (r, status) => { assert.equal(r.status, status, 'HTTPS status'); return r; };
  const json = r => JSON.parse(r.bytes.toString());
  const login = async () => {
    cookie = ''; check(await request('/api/session'), 401);
    const start = check(await request('/auth/start'), 302);
    for (const flag of [/; Secure/i, /; HttpOnly/i, /; SameSite=Lax/i]) assert.match(start.headers['set-cookie'].join(';'), flag);
    const authorization = new URL(start.headers.location); assert.equal(authorization.origin, issuer);
    const authorized = check(await request(authorization.href), 302);
    assert.equal(new URL(authorized.headers.location).origin, origin);
    check(await request(authorized.headers.location), 302);
    return json(check(await request('/api/session'), 200));
  };
  const session = await login(); const access = { 'x-dali-account': session.accountId, origin, 'x-dali-request': '1' };
  access['x-dali-recovery-epoch'] = json(check(await request('/api/recovery-state', 'GET', undefined, access), 200)).epoch;
  for (let i = 0; i < 60; i++) {
    if (json(check(await request('/api/storage-health', 'GET', undefined, access), 200)).backup.state === 'healthy') break;
    assert(i < 59, 'backup freshness deadline'); await pause(1000);
  }
  const board = json(check(await request('/api/boards', 'POST', Buffer.from(JSON.stringify({ title: 'Synthetic Kubernetes board', operationId: randomUUID() })), { ...access, 'content-type': 'application/json' }), 201));
  const chunk = (type, data) => { const b = Buffer.concat([Buffer.from(type), data]); const size = Buffer.alloc(4); size.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(b)); return Buffer.concat([size, b, crc]); };
  const h = Buffer.alloc(13); h.writeUInt32BE(1); h.writeUInt32BE(1, 4); h[8] = 8; h[9] = 6;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', h), chunk('IDAT', deflateSync(Buffer.from([0,48,96,192,255]))), chunk('IEND', Buffer.alloc(0))]);
  const key = createHash('sha256').update(png).digest('base64url'); const base = '/api/boards/' + board.summary.id;
  check(await request(base + '/blobs/' + key, 'PUT', png, { ...access, 'content-type': 'image/png' }), 200);
  const Y = await import('yjs'); const doc = new Y.Doc(); const path = base + '/docs/' + board.contentDocId;
  const binary = { ...access, 'content-type': 'application/octet-stream' };
  Y.applyUpdate(doc, check(await request(path + '/pull', 'POST', Buffer.from([0]), binary), 200).bytes);
  const page = [...doc.getMap('blocks').values()].find(b => b.get('sys:flavour') === 'affine:page'); assert(page);
  page.set('prop:title', new Y.Text('Synthetic Kubernetes acknowledged title'));
  assert.equal(json(check(await request(path + '/push', 'POST', Buffer.from(Y.encodeStateAsUpdate(doc)), binary), 200)).acknowledged, true);
  const expected = check(await request(path + '/pull', 'POST', Buffer.from([0]), binary), 200).bytes; doc.destroy();
  return async () => {
    const reopened = await login(); assert.equal(reopened.accountId, session.accountId, 'fresh signed identity');
    assert.equal(json(check(await request('/api/recovery-state', 'GET', undefined, access), 200)).epoch, access['x-dali-recovery-epoch'], 'restart epoch stable');
    check(await request(base, 'GET', undefined, access), 200);
    assert.deepEqual(check(await request(base + '/blobs/' + key, 'GET', undefined, access), 200).bytes, png, 'cold image bytes');
    assert.deepEqual(check(await request(path + '/pull', 'POST', Buffer.from([0]), binary), 200).bytes, expected, 'cold acknowledged document');
  };
}

async function runtime(args) {
  const o = argumentsForRuntime(args); const f = validateFixture(JSON.parse(await readFile(o.fixture, 'utf8')), o.local);
  const kubectl = async (...argv) => (await run('kubectl', ['--context', o.context, '--namespace', o.namespace, '--request-timeout=30s', ...argv], { timeout: 360000, maxBuffer: 2 ** 20 })).stdout;
  gate = 'selected context connectivity and absent namespace';
  // Discovery errors must never be interpreted as an absent namespace.
  assert.equal(JSON.parse(await kubectl('get', 'namespace', o.namespace, '--ignore-not-found', '-o', 'json') || 'null'), null, 'namespace must be absent');
  const rs = await resources(); const d = get(rs, 'Deployment'); const app = d.spec.template.spec.containers[0];
  app.image = o.appImage; d.spec.template.spec.containers[1].image = o.webImage;
  get(rs, 'PersistentVolumeClaim', 'dali-live').spec.storageClassName = f.liveStorageClass;
  get(rs, 'PersistentVolumeClaim', 'dali-backup').spec.storageClassName = f.backupStorageClass;
  if (o.local) {
    for (const claim of rs.filter(r => r.kind === 'PersistentVolumeClaim')) claim.spec.accessModes = ['ReadWriteOnce'];
    d.spec.template.spec.hostAliases = f.hostAliases;
  }
  const ingress = get(rs, 'Ingress'); const host = new URL(f.config.DALI_ORIGIN).hostname;
  ingress.spec.ingressClassName = f.ingressClass; ingress.spec.tls[0].hosts = [host]; ingress.spec.rules[0].host = host;
  get(rs, 'NetworkPolicy').spec = f.networkPolicy; validateResources(rs, { local: o.local });
  app.env.push({ name: 'NODE_EXTRA_CA_CERTS', value: '/trust/ca.pem' });
  app.volumeMounts.push({ name: 'trust', mountPath: '/trust', readOnly: true });
  d.spec.template.spec.volumes.push({ name: 'trust', configMap: { name: 'dali-trust' } });
  const ca = await readFile(f.caFile, 'utf8');
  const create = value => new Promise((resolve, reject) => {
    const p = spawn('kubectl', ['--context', o.context, '--namespace', o.namespace, '--request-timeout=30s', 'create', '-f', '-'], { stdio: ['pipe', 'ignore', 'ignore'] });
    const timer = setTimeout(() => { p.kill(); reject(new Error('Resource creation deadline')); }, 60000);
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Resource creation failed')); });
    p.stdin.on('error', () => {}); p.stdin.end(JSON.stringify(value));
  });
  // Atomic create refuses a racing namespace; only then are namespaced resources created.
  gate = 'create owned namespace and restricted deployment resources';
  await create({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: o.namespace, labels: { 'dali.example.org/smoke-owner': randomUUID(), 'pod-security.kubernetes.io/enforce': 'restricted' } } });
  await create({ apiVersion: 'v1', kind: 'List', items: [
    { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'dali-config' }, data: f.config },
    { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'dali-trust' }, data: { 'ca.pem': ca } },
    { apiVersion: 'v1', kind: 'Secret', metadata: { name: 'dali-auth' }, stringData: f.auth },
    { apiVersion: 'v1', kind: 'Secret', metadata: { name: 'dali-tls' }, type: 'kubernetes.io/tls', data: f.tls }, ...rs,
  ] });
  gate = 'real startup and readiness probes';
  await kubectl('rollout', 'status', 'deployment/dali', '--timeout=300s');
  const pods = async () => JSON.parse(await kubectl('get', 'pods', '-l', 'app=dali', '-o', 'json')).items;
  const claims = async () => JSON.parse(await kubectl('get', 'pvc', 'dali-live', 'dali-backup', '-o', 'json')).items.map(v => [v.metadata.uid, v.spec.volumeName]);
  const before = await pods(); assert.equal(before.length, 1, 'one scheduled writer');
  const persistent = await claims(); assert(persistent.every(v => v[1]), 'bound persistent storage');
  gate = 'verified TLS, signed OIDC and acknowledged board-image-document writes';
  const verify = await client(f);
  gate = 'terminate the old writer';
  await kubectl('scale', 'deployment/dali', '--replicas=0');
  await kubectl('wait', '--for=delete', 'pod/' + before[0].metadata.name, '--timeout=120s');
  assert.equal((await pods()).length, 0, 'old writer terminated');
  gate = 'replacement writer on the same persistent volumes';
  await kubectl('scale', 'deployment/dali', '--replicas=1');
  await kubectl('rollout', 'status', 'deployment/dali', '--timeout=300s');
  const after = await pods(); assert.equal(after.length, 1); assert.notEqual(after[0].metadata.uid, before[0].metadata.uid);
  assert.deepEqual(await claims(), persistent, 'same PVCs and PVs');
  gate = 'fresh signed login and cold persisted content';
  await verify();
  console.log(o.local ? 'LOCAL_DEPLOYMENT_SMOKE_PASS (live-volume restart; shared host failure domain)' : 'DEPLOYMENT_SMOKE_PASS');
  console.log('Owned disposable namespace retained for inspection; cleanup requires explicit operator selection.');
}

try {
  if (process.argv.includes('--self-test')) await selfTest();
  else if (process.argv.includes('--check-manifests')) {
    for (const path of ['deploy/kubernetes/base', 'deploy/kubernetes/overlays/example']) {
      const { stdout } = await run('kubectl', ['kustomize', path], { cwd: root, timeout: 30000, maxBuffer: 2 ** 20 });
      for (const kind of ['Deployment', 'Service', 'PersistentVolumeClaim', 'NetworkPolicy']) assert(stdout.includes('kind: ' + kind), 'rendered ' + kind);
      assert.match(stdout, /replicas: 1\b/);
    }
    validateResources(await resources()); validateResources(await resources(true));
    console.log('MANIFEST_CHECK_PASS (static configuration only)');
  } else await runtime(process.argv.slice(2));
} catch (error) {
  // Keep operator config, provider bodies, command output and paths out of reports.
  console.error('DEPLOYMENT_SMOKE_FAILED: ' + gate + ': ' + (error instanceof assert.AssertionError ? error.message.split('\n')[0] : 'required environment or runtime gate failed'));
  process.exitCode = 1;
}
