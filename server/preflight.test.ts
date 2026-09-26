import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const runtimeConfig = {
  DALI_ORIGIN: 'https://canvas.example.org', DALI_DATABASE_PATH: ':memory:',
  DALI_SESSION_SECRET: 'synthetic-session-secret-at-least-thirty-two-characters', DALI_SESSION_TTL_MS: '86400000',
  DALI_OIDC_ISSUER: 'https://identity.example.org', DALI_OIDC_CLIENT_ID: 'synthetic-client',
  DALI_OIDC_CLIENT_SECRET: 'synthetic-secret', DALI_OIDC_CALLBACK_URL: 'https://canvas.example.org/auth/callback',
  DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]',
  DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
};

describe('@04-13-02 production runtime boundary', () => {
  it('keeps liveness independent while configuration gates readiness', async () => {
    const app = await buildApp({ config: {} });
    try {
      expect((await app.inject('/health/live')).statusCode).toBe(200);
      expect((await app.inject('/health/ready')).statusCode).toBe(503);
    } finally { await app.close(); }
  });

  it('reports initialized database ready without contacting the identity provider', async () => {
    const app = await buildApp({ config: runtimeConfig, storagePolicy: { kind: 'fixture' } });
    try {
      expect((await app.inject('/health/ready')).statusCode).toBe(200);
      expect((await app.inject('/health/live')).json()).toEqual({ status: 'live' });
    } finally { await app.close(); }
  });

  it('accepts forwarding only from the explicit loopback proxy', async () => {
    const app = await buildApp({ config: { ...runtimeConfig, DALI_TRUST_PROXY: 'loopback' }, storagePolicy: { kind: 'fixture' } });
    app.get('/protocol-probe', request => ({ protocol: request.protocol }));
    try {
      const headers = { 'x-forwarded-proto': 'https' };
      expect((await app.inject({ url: '/protocol-probe', remoteAddress: '127.0.0.1', headers })).json()).toEqual({ protocol: 'https' });
      expect((await app.inject({ url: '/protocol-probe', remoteAddress: '203.0.113.8', headers })).json()).toEqual({ protocol: 'http' });
    } finally { await app.close(); }
  });

  it('rejects a configuration that trusts arbitrary external proxies', async () => {
    let error = '';
    try { const app = await buildApp({ config: { ...runtimeConfig, DALI_TRUST_PROXY: 'true' } }); await app.close(); }
    catch (caught) { error = (caught as Error).message; }
    expect(error).toBe('Proxy configuration unavailable');
  });
});

const pins = {
  fastify: '5.12.5', '@fastify/cookie': '11.1.2', '@fastify/session': '11.1.3',
  'openid-client': '6.8.8', 'better-sqlite3': '13.0.3', yjs: '13.6.31',
  rxjs: '7.8.2', 'y-protocols': '1.0.7',
};

describe('@03-01-01 server dependency preflight', () => {
  it('declares the reviewed exact runtime pins without changing canvas pins', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(manifest.dependencies).toMatchObject(pins);
    expect(manifest.dependencies['@blocksuite/affine']).toBe('0.22.4');
    expect(manifest.devDependencies['@types/better-sqlite3']).toBe('9.6.0');
  });

  it('loads real OIDC and session ESM exports', async () => {
    for (const name of ['fastify', '@fastify/cookie', '@fastify/session']) {
      expect((await import(name)).default).toBeTypeOf('function');
    }
    const name = 'openid-client';
    expect((await import(name)).authorizationCodeGrant).toBeTypeOf('function');
  });

  it('commits successful SQL and removes the canary from a failed transaction', async () => {
    const name = 'better-sqlite3';
    const Database = (await import(name)).default;
    const database = new Database(':memory:');
    try {
      database.exec('CREATE TABLE preflight (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
      const insert = database.prepare('INSERT INTO preflight VALUES (?, ?)');
      database.transaction(() => insert.run('committed', 'synthetic committed value'))();
      expect(() => database.transaction(() => {
        insert.run('rollback', 'synthetic forbidden canary');
        throw new Error('deliberate rollback');
      })()).toThrow('deliberate rollback');
      expect(database.prepare('SELECT * FROM preflight ORDER BY id').all()).toEqual([
        { id: 'committed', value: 'synthetic committed value' },
      ]);
    } finally { database.close(); }
  });
});
