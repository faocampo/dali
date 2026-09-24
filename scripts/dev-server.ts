/** Loopback-only synthetic development composition, outside the production graph. */
import { randomBytes } from 'node:crypto';
import { chmod, link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createProbe } from 'node:net';
import { resolve, join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { buildApp } from '../server/app.js';
import { createOidcProvider } from '../tests/oidc-provider.js';
import { seedLocalRoleBoard } from './dev-role-board.js';

export type DevOptions = { uiPort: number; apiPort: number; providerPort: number; stateDirectory: string };
const port = (value: string, name: string) => {
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) throw new Error(`${name} must be an integer from 1024 to 65535.`);
  return Number(value);
};
export function readDevOptions(args: string[], env: Record<string, string | undefined>): DevOptions {
  let ui = env.DALI_DEV_UI_PORT ?? '5173';
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--port' && args[index + 1]) ui = args[++index]!;
    else if (arg === '--host' && args[index + 1] === '127.0.0.1') index++;
    else if (arg !== '--strictPort') throw new Error('Local development accepts --port <port>, --host 127.0.0.1, and --strictPort.');
  }
  const options = {
    uiPort: port(ui, 'UI port'), apiPort: port(env.DALI_DEV_API_PORT ?? '5174', 'API port'),
    providerPort: port(env.DALI_DEV_OIDC_PORT ?? '5175', 'OIDC port'),
    stateDirectory: resolve(env.DALI_DEV_STATE_DIR ?? '.gsd/local-dev'),
  };
  if (new Set([options.uiPort, options.apiPort, options.providerPort]).size !== 3) throw new Error('Local development requires three distinct ports.');
  return options;
}

type State = { version: 1; origin: string; issuer: string; sessionSecret: string };
export async function loadDevState(options: DevOptions): Promise<State> {
  const origin = `http://127.0.0.1:${options.uiPort}`; const issuer = `http://127.0.0.1:${options.providerPort}`;
  await mkdir(options.stateDirectory, { recursive: true, mode: 0o700 });
  await chmod(options.stateDirectory, 0o700);
  const file = join(options.stateDirectory, 'identity.json');
  const temporary = join(options.stateDirectory, `.identity-${randomBytes(12).toString('hex')}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, origin, issuer, sessionSecret: randomBytes(32).toString('base64url') }), { flag: 'wx', mode: 0o600 });
    await link(temporary, file); // Publish a complete secret atomically, without replacing existing state.
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('Could not create private local development identity state.'); }
  finally { await rm(temporary, { force: true }); }
  let state: State;
  try {
    state = JSON.parse(await readFile(file, 'utf8')) as State;
    if (state.version !== 1 || !/^[\w-]{43}$/.test(state.sessionSecret)) throw new Error();
    await chmod(file, 0o600);
  } catch { throw new Error('Local development identity state is invalid. Restore identity.json from a backup or choose a new DALI_DEV_STATE_DIR. Existing state was preserved.'); }
  if (state.origin !== origin || state.issuer !== issuer) throw new Error('Local development ports differ from the saved identity origin. Reuse the original UI/OIDC ports or choose a separate DALI_DEV_STATE_DIR.');
  return state;
}

async function assertPortAvailable(portNumber: number) {
  await new Promise<void>((resolveProbe, reject) => {
    const probe = createProbe();
    probe.once('error', () => reject(new Error(`Local development port ${portNumber} is unavailable. Stop the conflicting service or configure a different port; automatic fallback is disabled.`)));
    probe.listen({ host: '127.0.0.1', port: portNumber, exclusive: true }, () => probe.close(error => error ? reject(error) : resolveProbe()));
  });
}

export async function startLocalDevelopment(options: DevOptions, stopped: () => boolean = () => false) {
  if (process.env.NODE_ENV === 'production') throw new Error('Synthetic local development requires a non-production environment.');
  process.umask(0o077);
  let provider: Awaited<ReturnType<typeof createOidcProvider>> | undefined;
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let vite: ViteDevServer | undefined;
  let closing: Promise<void> | undefined;
  let finish!: () => void;
  let fail!: (error: Error) => void;
  const closed = new Promise<void>((resolveClosed, reject) => { finish = resolveClosed; fail = reject; });
  // Startup may fail before the caller starts awaiting this promise.
  void closed.catch(() => {});
  const close = () => closing ??= (async () => {
    await Promise.allSettled([vite?.close(), app?.close(), provider?.close()]);
    finish();
  })();
  const ensureRunning = () => { if (stopped()) throw new Error('Local development startup interrupted.'); };
  try {
    for (const value of [options.uiPort, options.apiPort, options.providerPort]) { await assertPortAvailable(value); ensureRunning(); }
    const state = await loadDevState(options); ensureRunning();
    const registration = { clientId: 'synthetic-local-development', clientSecret: randomBytes(32).toString('base64url'), redirectUri: `${state.origin}/auth/callback` };
    provider = await createOidcProvider({ port: options.providerPort, clients: [registration],
      signInPage: { title: 'Dali local development — synthetic sign-in', notice: 'Local development only. Open Shared role test to try Owner, Editor or Viewer access with the matching synthetic account. Roles apply per board; creating a board makes you its Owner.' },
    }); ensureRunning();
    app = await buildApp({ config: {
      DALI_ORIGIN: state.origin, DALI_DATABASE_PATH: join(options.stateDirectory, 'boards.sqlite'),
      DALI_SESSION_SECRET: state.sessionSecret, DALI_SESSION_TTL_MS: '86400000',
      DALI_OIDC_ISSUER: state.issuer, DALI_OIDC_CLIENT_ID: registration.clientId,
      DALI_OIDC_CLIENT_SECRET: registration.clientSecret, DALI_OIDC_CALLBACK_URL: registration.redirectUri,
      DALI_INTERNAL_CLAIM: 'membership', DALI_INTERNAL_VALUES_JSON: '["internal"]',
      DALI_INTERNAL_EMAIL_DOMAINS_JSON: '["example.org"]', DALI_EMAIL_CASE_FOLD: 'false',
    } }); ensureRunning();
    seedLocalRoleBoard(join(options.stateDirectory, 'boards.sqlite'), state.issuer); ensureRunning();
    await app.listen({ host: '127.0.0.1', port: options.apiPort }); ensureRunning();
    const target = `http://127.0.0.1:${options.apiPort}`;
    vite = await createServer({ server: { host: '127.0.0.1', port: options.uiPort, strictPort: true,
      proxy: { '/api': target, '/auth': target },
      // Local runtime secrets and board files must never be served by Vite.
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.gsd/**', `${options.stateDirectory}/**`] },
    } }); ensureRunning();
    await vite.listen(); ensureRunning();
    for (const server of [vite.httpServer, app.server, provider.app.server]) {
      server?.once('close', () => {
        if (!closing) { fail(new Error('A local development service stopped unexpectedly; all services are stopping.')); void close(); }
      });
      server?.once('error', () => { fail(new Error('A local development service failed; all services are stopping.')); void close(); });
    }
    return { origin: state.origin, close, closed };
  } catch (error) { await close(); throw error; }
}
