/** Test-only process entrypoint. Never imported by production startup. */
import { proxyApplicationAssets } from './application-assets.js';
import { buildApp } from '../app.js';
import { openDatabase } from '../storage/database.js';

process.once('message', async (input: { config: Record<string, string>; assets: string; port: number }) => {
  const database = openDatabase(input.config.DALI_DATABASE_PATH!);
  let mode = 'none'; let committed = false;
  const hold = () => new Promise<void>(() => {});
  // Wrap only the injected test connection. Production receives no fault knobs.
  const transaction = database.transaction.bind(database);
  database.transaction = ((fn: (...args: unknown[]) => unknown) => {
    const run = transaction((...args: unknown[]) => {
      const result = fn(...args);
      if (mode === 'before' && result && typeof result === 'object' && 'acknowledged' in result && result.acknowledged === true) {
        // Deliberately keep SQLite's synchronous transaction open until SIGKILL.
        process.send?.({ type: 'boundary', boundary: 'before' });
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      }
      return result;
    });
    return Object.assign((...args: unknown[]) => {
      let result: unknown;
      try { result = run(...args); }
      catch (error) {
        process.send?.({ type: 'boundary', boundary: (error as { code?: string }).code });
        throw error;
      }
      if (result && typeof result === 'object' && 'acknowledged' in result && result.acknowledged === true) committed = true;
      return result;
    }, run);
  }) as typeof database.transaction;
  const app = await buildApp({ storagePolicy: { kind: 'fixture' }, config: input.config, database, beforeCommit: async () => {
    if (mode === 'readonly') database.pragma('query_only = ON');
    if (mode === 'full') database.pragma(`max_page_count = ${database.pragma('page_count', { simple: true })}`);
  } });
  app.addHook('onSend', async (request, _reply, payload) => {
    if (mode === 'after' && committed && (request.url.endsWith('/push') || request.method === 'PUT')) {
      process.send?.({ type: 'boundary', boundary: 'after' }); await hold();
    }
    return payload;
  });
  process.on('message', (message: { mode: string }) => {
    mode = message.mode; committed = false;
    if (mode === 'none') { database.pragma('query_only = OFF'); database.pragma('max_page_count = 4294967294'); }
    process.send?.({ type: 'armed' });
  });
  const closeAssets = proxyApplicationAssets(app, input.assets);
  await app.listen({ host: '127.0.0.1', port: input.port });
  process.once('SIGTERM', () => { closeAssets(); void app.close().then(() => { database.close(); process.exit(0); }); });
  process.send?.({ type: 'ready', pragmas: {
    journal: database.pragma('journal_mode', { simple: true }),
    synchronous: database.pragma('synchronous', { simple: true }),
    foreignKeys: database.pragma('foreign_keys', { simple: true }),
  } });
});
