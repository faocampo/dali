import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { configureDurableDatabase } from './database.js';
import { createDurabilityService } from '../../tests/durability-fixtures.js';

beforeAll(() => { execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json']); }, 30000);

it('@04-01-02 child can arm an exact transaction boundary over private IPC', async () => {
  const service = await createDurabilityService('http://127.0.0.1:1');
  try { expect(await service.command('before'), 'child must acknowledge its armed boundary').toBe(true); }
  finally { await service.close(); }
});

it('@04-01-02 incompatible persistent configuration closes and rejects the connection', () => {
  const database = new Database(':memory:');
  expect(() => configureDurableDatabase(database, true)).toThrow('Required database durability');
  expect(database.open).toBe(false);
  const unit = new Database(':memory:'); configureDurableDatabase(unit, false);
  expect(unit.open).toBe(true); unit.close();
});
