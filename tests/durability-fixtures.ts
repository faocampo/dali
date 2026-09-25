import { fork, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createOidcProvider } from './oidc-provider.js';
import { IDENTITY_COOKIE } from './oidc-provider.js';

/** Signed OIDC authorization-code flow for HTTP-only crash tests. */
export async function durabilityActor(origin: string, identity = 'owner') {
  const start = await fetch(origin + '/auth/start', { redirect: 'manual' });
  const browserCookie = start.headers.getSetCookie().at(-1)!.split(';')[0]!;
  const authorize = await fetch(start.headers.get('location')!, { redirect: 'manual', headers: { cookie: `${IDENTITY_COOKIE}=${identity}` } });
  const callback = await fetch(authorize.headers.get('location')!, { redirect: 'manual', headers: { cookie: browserCookie } });
  const cookie = callback.headers.getSetCookie().at(-1)!.split(';')[0]!;
  const session = await fetch(origin + '/api/session', { headers: { cookie } });
  if (session.status !== 200) throw new Error('Synthetic signed authentication failed');
  const member = await session.json() as { accountId: string };
  return { cookie, 'x-dali-account': member.accountId, 'x-dali-request': '1', origin };
}

export async function createDurabilityService(assets: string) {
  const directory = await mkdtemp(join(tmpdir(), 'dali-durability-'));
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const registration = { clientId: 'synthetic-durability', clientSecret: randomBytes(32).toString('hex'), redirectUri: origin + '/auth/callback' };
  const provider = await createOidcProvider({ port: 0, clients: [registration] });
  const databasePath = join(directory, 'boards.sqlite');
  const config = {
    DALI_ORIGIN: origin, DALI_DATABASE_PATH: databasePath, DALI_SESSION_SECRET: randomBytes(32).toString('hex'), DALI_SESSION_TTL_MS: '86400000',
    DALI_OIDC_ISSUER: provider.issuer, DALI_OIDC_CLIENT_ID: registration.clientId, DALI_OIDC_CLIENT_SECRET: registration.clientSecret,
    DALI_OIDC_CALLBACK_URL: registration.redirectUri, DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]', DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]',
  };
  let child: ChildProcess;
  async function command(mode: string) {
    return new Promise<boolean>(resolve => {
      const timer = setTimeout(() => { child.off('message', listener); resolve(false); }, 1000);
      const listener = (message: unknown) => {
        if ((message as { type: string }).type === 'armed') { clearTimeout(timer); child.off('message', listener); resolve(true); }
      };
      child.on('message', listener); child.send({ mode });
    });
  }
  async function start() {
    child = fork(join(process.cwd(), '.gsd/access-build/server/testing/durability-child.js'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    const ready = new Promise<{ type: string; pragmas: { journal: string; synchronous: number; foreignKeys: number } }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Durability child startup timed out')), 20000);
      child.once('message', message => { clearTimeout(timer); resolve(message as never); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Durability child exited: ${code}`)); });
      child.once('error', reject);
    });
    child.send({ config, assets, port });
    return ready;
  }
  async function stop(signal: NodeJS.Signals = 'SIGKILL') {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(signal); await exited; }
  }
  try {
    const ready = await start();
    return { origin, databasePath, pragmas: ready.pragmas, command,
      waitForBoundary() {
        return new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => { child.off('message', listener); reject(new Error('Commit boundary not reached')); }, 10000);
          const listener = (message: unknown) => {
            const value = message as { type: string; boundary: string };
            if (value.type === 'boundary') { clearTimeout(timer); child.off('message', listener); resolve(value.boundary); }
          };
          child.on('message', listener);
        });
      },
      async killAndRestart(signal: NodeJS.Signals = 'SIGKILL') { await stop(signal); return start(); },
      async close() { await stop(); await provider.close(); await rm(directory, { recursive: true, force: true }); },
    };
  } catch (error) { await stop(); await provider.close(); await rm(directory, { recursive: true, force: true }); throw error; }
}
