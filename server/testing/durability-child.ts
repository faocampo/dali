/** Test-only process entrypoint. Never imported by production startup. */
import { buildApp } from '../app.js';
import { openDatabase } from '../storage/database.js';

process.once('message', async (input: { config: Record<string, string>; assets: string; port: number }) => {
  const database = openDatabase(input.config.DALI_DATABASE_PATH!);
  const app = await buildApp({ config: input.config, database });
  app.get('/*', async (request, reply) => {
    const response = await fetch(input.assets + request.url);
    return reply.type(response.headers.get('content-type') ?? 'text/html').send(Buffer.from(await response.arrayBuffer()));
  });
  await app.listen({ host: '127.0.0.1', port: input.port });
  process.send?.({ type: 'ready', pragmas: {
    journal: database.pragma('journal_mode', { simple: true }),
    synchronous: database.pragma('synchronous', { simple: true }),
    foreignKeys: database.pragma('foreign_keys', { simple: true }),
  } });
});
