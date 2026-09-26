import { expect, it } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { buildApp } from '../app.js';
import { openDatabase } from './database.js';
import { inspectBackupSet } from './backup.js';
import { BackupScheduler } from './backup-scheduler.js';

it('@04-11-01 startup runs the due verified baseline before admission', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dali-schedule-'));
  const destination = { directory: join(directory, 'backups'), independentStorage: true as const };
  await mkdir(destination.directory, { mode: 0o700 });
  const database = openDatabase(join(directory, 'live.sqlite'));
  const app = await buildApp({ database, config: {
    DALI_ORIGIN: 'http://127.0.0.1:5499', DALI_DATABASE_PATH: database.name,
    DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: 'https://identity.example.org', DALI_OIDC_CLIENT_ID: 'synthetic', DALI_OIDC_CLIENT_SECRET: 'synthetic',
    DALI_OIDC_CALLBACK_URL: 'http://127.0.0.1:5499/auth/callback', DALI_INTERNAL_CLAIM: 'membership',
    DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
  } });
  const scheduler = new BackupScheduler({ database, destination, applicationVersion: '0.1.0' });
  try {
    await expect(scheduler.start()).resolves.toBeUndefined();
    expect(await inspectBackupSet(destination)).toHaveLength(1);
  } finally { await scheduler.close(); await app.close(); database.close(); await rm(directory, { recursive: true, force: true }); }
});
