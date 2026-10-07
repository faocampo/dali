#!/usr/bin/env node
/** Owned synthetic fixtures only. Neither this script nor its identity provider enters the images. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { mkdtemp, readFile, writeFile, copyFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';
import { crc32, deflateSync } from 'node:zlib';

const origin = 'https://localhost:9443';
const issuer = 'https://localhost:9444';
const run = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = bytes => createHash('sha256').update(bytes).digest('base64url');

async function fixture() {
  const tls = { key: await readFile('/fixture/key.pem'), cert: await readFile('/fixture/cert.pem') };
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic-key', use: 'sig', alg: 'RS256' };
  const codes = new Map(); const tokens = new Map(); let online = true;
  const json = (response, body, status = 200) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(body)); };
  const provider = https.createServer(tls, async (request, response) => {
    try {
      const url = new URL(request.url, issuer); const p = url.searchParams;
      // This control exists only in this separately mounted synthetic fixture.
      if (url.pathname === '/fixture/offline') { online = false; return json(response, { offline: true }); }
      if (!online) return json(response, { error: 'temporarily_unavailable' }, 503);
      if (url.pathname === '/health') return json(response, { ready: true });
      if (url.pathname === '/.well-known/openid-configuration') return json(response, {
        issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
        jwks_uri: issuer + '/jwks', userinfo_endpoint: issuer + '/userinfo', response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'], subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        code_challenge_methods_supported: ['S256'], authorization_response_iss_parameter_supported: true,
      });
      if (url.pathname === '/jwks') return json(response, { keys: [jwk] });
      if (url.pathname === '/authorize') {
        assert.equal(p.get('client_id'), 'synthetic-image-smoke'); assert.equal(p.get('redirect_uri'), origin + '/auth/callback');
        assert.equal(p.get('code_challenge_method'), 'S256'); assert.equal(p.get('response_type'), 'code');
        assert(p.get('nonce') && p.get('state') && p.get('code_challenge'));
        const code = randomUUID(); codes.set(code, { challenge: p.get('code_challenge'), nonce: p.get('nonce'), expires: Date.now() + 60000 });
        const target = new URL(origin + '/auth/callback'); target.searchParams.set('code', code); target.searchParams.set('state', p.get('state')); target.searchParams.set('iss', issuer);
        response.writeHead(302, { location: target.href }); return response.end();
      }
      if (url.pathname === '/token') {
        let body = ''; for await (const chunk of request) { body += chunk; assert(body.length < 16384); }
        const form = new URLSearchParams(body); const code = codes.get(form.get('code')); codes.delete(form.get('code'));
        let id = form.get('client_id'); let secret = form.get('client_secret');
        if (request.headers.authorization?.startsWith('Basic ')) {
          const basic = Buffer.from(request.headers.authorization.slice(6), 'base64').toString(); const colon = basic.indexOf(':');
          id = decodeURIComponent(basic.slice(0, colon)); secret = decodeURIComponent(basic.slice(colon + 1));
        }
        assert.equal(id, 'synthetic-image-smoke'); assert.equal(secret, process.env.DALI_OIDC_CLIENT_SECRET);
        assert(code && code.expires > Date.now()); assert.equal(digest(form.get('code_verifier')), code.challenge);
        assert.equal(form.get('redirect_uri'), origin + '/auth/callback'); assert.equal(form.get('grant_type'), 'authorization_code');
        const seconds = Math.floor(Date.now() / 1000);
        const claims = { sub: 'synthetic-owner', name: 'Synthetic Owner', email: 'owner@example.org', email_verified: true, membership: 'internal', iss: issuer, aud: id, nonce: code.nonce, iat: seconds, exp: seconds + 300 };
        const input = [ { alg: 'RS256', typ: 'JWT', kid: jwk.kid }, claims ].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
        const access = randomUUID(); tokens.set(access, claims);
        return json(response, { access_token: access, token_type: 'Bearer', expires_in: 300, id_token: input + '.' + sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url') });
      }
      if (url.pathname === '/userinfo') { const claims = tokens.get(request.headers.authorization?.replace('Bearer ', '')); assert(claims); return json(response, claims); }
      return json(response, { error: 'not_found' }, 404);
    } catch { json(response, { error: 'invalid_request' }, 400); }
  });
  const ingress = https.createServer(tls, (request, response) => {
    const proxy = http.request({ host: '127.0.0.1', port: 8080, path: request.url, method: request.method, headers: { ...request.headers, host: 'localhost:9443' } }, upstream => {
      response.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(response);
    });
    proxy.on('error', () => { response.writeHead(502); response.end(); }); request.pipe(proxy);
  });
  await Promise.all([new Promise(resolve => provider.listen(9444, '127.0.0.1', resolve)), new Promise(resolve => ingress.listen(9443, '127.0.0.1', resolve))]);
}

async function client(mode) {
  const ca = await readFile('/fixture/cert.pem'); let cookie = '';
  const request = (path, method = 'GET', body, headers = {}) => new Promise((resolve, reject) => {
    const url = new URL(path, origin);
    const req = https.request(url, { ca, method, headers: { ...(cookie && url.origin === origin ? { cookie } : {}), ...headers, ...(body ? { 'content-length': body.length } : {}) } }, response => {
      if (url.origin === origin && response.headers['set-cookie']) cookie = response.headers['set-cookie'].at(-1).split(';')[0];
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.setTimeout(10000, () => req.destroy(new Error('HTTP deadline'))); req.end(body);
  });
  if (mode === 'probe') { assert.equal((await request('/health/ready')).status, 200); return; }
  const check = (response, status, label) => { if (response.status !== status) throw new Error('SMOKE_GATE: ' + label + ' status ' + response.status); return response; };
  const parse = response => JSON.parse(response.bytes.toString());
  if (mode === 'seed') {
    const index = check(await request('/'), 200, 'static index');
    const source = index.bytes.toString().match(/src="([^\"]+\.js)"/); assert(source, 'Vite entrypoint');
    check(await request(source[1]), 200, 'static javascript');
    check(await request('/health/live'), 200, 'liveness'); check(await request('/health/ready'), 200, 'readiness');
    check(await request('/api/session'), 401, 'unauthenticated protection');
    const start = check(await request('/auth/start', 'GET', undefined, { 'x-forwarded-proto': 'http', 'x-forwarded-host': 'attacker.example.org', forwarded: 'host=attacker.example.org;proto=http' }), 302, 'OIDC redirect');
    const cookies = start.headers['set-cookie'].join(';'); assert.match(cookies, /; Secure/i); assert.match(cookies, /; HttpOnly/i); assert.match(cookies, /; SameSite=Lax/i);
    const authorization = new URL(start.headers.location); assert.equal(authorization.origin, issuer); assert.equal(authorization.searchParams.get('redirect_uri'), origin + '/auth/callback');
    const authorized = check(await request(authorization.href), 302, 'signed provider authorization');
    assert.equal(new URL(authorized.headers.location).origin, origin);
    check(await request(authorized.headers.location), 302, 'OIDC callback');
    const session = parse(check(await request('/api/session'), 200, 'authenticated session'));
    const access = { 'x-dali-account': session.accountId, origin, 'x-dali-request': '1' };
    const recovery = parse(check(await request('/api/recovery-state', 'GET', undefined, access), 200, 'recovery epoch'));
    access['x-dali-recovery-epoch'] = recovery.epoch;
    const board = parse(check(await request('/api/boards', 'POST', Buffer.from(JSON.stringify({ title: 'Synthetic production board', operationId: randomUUID() })), { ...access, 'content-type': 'application/json' }), 201, 'create board'));
    const chunk = (type, data) => {
      const content = Buffer.concat([Buffer.from(type), data]); const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
      const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(content)); return Buffer.concat([size, content, checksum]);
    };
    const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
    const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0,48,96,192,255]))), chunk('IEND', Buffer.alloc(0))]);
    const key = digest(png); const base = '/api/boards/' + board.summary.id;
    check(await request(base + '/blobs/' + key, 'PUT', png, { ...access, 'content-type': 'image/png' }), 200, 'image upload');
    const Y = await import('/app/node_modules/yjs/dist/yjs.mjs'); const doc = new Y.Doc();
    const binary = { ...access, 'content-type': 'application/octet-stream' };
    const path = base + '/docs/' + board.contentDocId;
    const current = check(await request(path + '/pull', 'POST', Buffer.from([0]), binary), 200, 'document pull');
    Y.applyUpdate(doc, current.bytes);
    const page = [...doc.getMap('blocks').values()].find(block => block.get('sys:flavour') === 'affine:page'); assert(page);
    page.set('prop:title', new Y.Text('Synthetic acknowledged title'));
    const update = Buffer.from(Y.encodeStateAsUpdate(doc));
    assert.equal(parse(check(await request(path + '/push', 'POST', update, binary), 200, 'document push')).acknowledged, true);
    const saved = check(await request(path + '/pull', 'POST', Buffer.from([0]), binary), 200, 'acknowledged document read'); doc.destroy();
    await writeFile('/fixture/state.json', JSON.stringify({ cookie, access, base, path, key, png: png.toString('base64'), document: saved.bytes.toString('base64') }), { mode: 0o600 });
    check(await request(issuer + '/fixture/offline'), 200, 'provider outage control');
    check(await request(issuer + '/health'), 503, 'provider outage established');
    check(await request('/health/live'), 200, 'liveness during provider outage');
    check(await request('/health/ready'), 200, 'readiness during provider outage');
    return;
  }
  const saved = JSON.parse(await readFile('/fixture/state.json', 'utf8')); cookie = saved.cookie;
  check(await request('/api/session'), 200, 'session after restart');
  check(await request(saved.base, 'GET', undefined, saved.access), 200, 'board after restart');
  const image = check(await request(saved.base + '/blobs/' + saved.key, 'GET', undefined, saved.access), 200, 'image after restart');
  assert.equal(image.bytes.toString('base64'), saved.png);
  const document = check(await request(saved.path + '/pull', 'POST', Buffer.from([0]), { ...saved.access, 'content-type': 'application/octet-stream' }), 200, 'document after restart');
  assert.equal(document.bytes.toString('base64'), saved.document);
  check(await request('/health/ready'), 200, 'ready after restart');
}

async function host() {
  const argument = name => { const index = process.argv.indexOf(name); assert(index >= 0 && process.argv[index + 1], 'Required image argument'); return process.argv[index + 1]; };
  const appImage = argument('--app-image'); const webImage = argument('--web-image');
  const id = 'dali-smoke-' + randomUUID().slice(0, 12); const containers = []; const volumes = [];
  const directory = await mkdtemp(join(tmpdir(), 'dali-image-smoke-')); let step = 'daemon preflight';
  const docker = async (...args) => (await run('docker', args, { timeout: 90000, maxBuffer: 2 ** 20 })).stdout.trim();
  const start = async (name, args) => { containers.push(name); return docker('run', '-d', '--name', name, ...args); };
  const web = id + '-web'; const fixtureName = id + '-fixture'; const app = id + '-app';
  try {
    await docker('info', '--format', '{{.ServerVersion}}');
    for (const image of [appImage, webImage]) await docker('image', 'inspect', image, '--format', '{{.Id}}');
    step = 'synthetic TLS fixture'; await chmod(directory, 0o755);
    await run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost', '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem')]);
    await chmod(join(directory, 'cert.pem'), 0o644);
    await copyFile(fileURLToPath(import.meta.url), join(directory, 'smoke.mjs'));
    const env = { NODE_ENV: 'production', NODE_EXTRA_CA_CERTS: '/fixture/cert.pem', DALI_ORIGIN: origin,
      DALI_DATABASE_PATH: '/data/boards.sqlite', DALI_SESSION_SECRET: randomBytes(48).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
      DALI_OIDC_ISSUER: issuer, DALI_OIDC_CLIENT_ID: 'synthetic-image-smoke', DALI_OIDC_CLIENT_SECRET: randomBytes(32).toString('hex'),
      DALI_OIDC_CALLBACK_URL: origin + '/auth/callback', DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]',
      DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]', DALI_TRUST_PROXY: 'loopback', DALI_BACKUP_DIRECTORY: '/backups', DALI_BACKUP_INDEPENDENT_STORAGE: 'true' };
    const envPath = join(directory, 'synthetic.env'); await writeFile(envPath, Object.entries(env).map(([key, value]) => key + '=' + value).join('\n'), { mode: 0o600 });
    step = 'owned volume initialization';
    for (const suffix of ['data', 'backups']) { const volume = id + '-' + suffix; volumes.push(volume); await docker('volume', 'create', volume); }
    await docker('run', '--rm', '--user', '0:0', '-v', volumes[0] + ':/data', '-v', volumes[1] + ':/backups', appImage, 'node', '--input-type=module', '-e', "import fs from 'node:fs'; for(const p of ['/data','/backups']) {fs.chownSync(p,1000,1000);fs.chmodSync(p,0o700);}");
    step = 'production containers';
    const secure = ['--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--tmpfs', '/tmp'];
    await start(web, [...secure, webImage]);
    const network = ['--network', 'container:' + web];
    await start(fixtureName, [...network, '--user', '0:0', '--env-file', envPath, '-v', directory + ':/fixture', appImage, 'node', '/fixture/smoke.mjs', '--fixture']);
    await start(app, [...network, ...secure, '--env-file', envPath, '-v', directory + ':/fixture:ro', '-v', volumes[0] + ':/data', '-v', volumes[1] + ':/backups', appImage]);
    const invoke = async mode => {
      try { return await docker('exec', fixtureName, 'node', '/fixture/smoke.mjs', '--client', mode); }
      catch (error) { const label = error.stderr?.match(/^SMOKE_GATE: ([a-zA-Z ,0-9-]+)$/m)?.[1]; if (label) step = label; throw new Error('Client gate failed'); }
    };
    const ready = async () => { for (let i = 0; i < 45; i++) { try { await invoke('probe'); return; } catch { await sleep(250); } } throw new Error('Readiness deadline'); };
    step = 'TLS readiness'; await ready();
    step = 'static, signed OIDC, spoof protection, writes and outage'; await invoke('seed');
    step = 'SIGTERM drain'; const began = performance.now(); await docker('stop', '--time', '50', app);
    assert(performance.now() - began < 45000, 'Shutdown exceeded budget');
    assert.equal(await docker('inspect', '--format', '{{.State.ExitCode}}', app), '0', 'Graceful exit');
    step = 'restart and durable acknowledgments'; await docker('start', app); await ready(); await invoke('verify');
    console.log('IMAGE_SMOKE_PASS');
  } catch { throw new Error('IMAGE_SMOKE_FAILED: ' + step); }
  finally {
    for (const name of containers.reverse()) await docker('rm', '-f', name).catch(() => {});
    for (const volume of volumes) await docker('volume', 'rm', volume).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
}

try {
  if (process.argv.includes('--fixture')) await fixture();
  else if (process.argv.includes('--client')) await client(process.argv.at(-1));
  else await host();
} catch (error) { console.error(error.message); process.exitCode = 1; }
