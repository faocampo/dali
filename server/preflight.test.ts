import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
