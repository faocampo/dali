import type { FastifyInstance } from 'fastify';

export const SHUTDOWN_BUDGET_MS = 45_000;
type LifecycleOptions = { ready: () => boolean; onDrain: () => void; timeoutMs?: number };
export type ProductionLifecycle = { readonly draining: boolean; drain: () => Promise<void> };
const lifecycles = new WeakMap<FastifyInstance, ProductionLifecycle>();

/** Health is local: identity-provider and backup publication failures never kill liveness. */
export function startProductionLifecycle(app: FastifyInstance, options: LifecycleOptions): ProductionLifecycle {
  let draining = false;
  let pending: Promise<void> | undefined;
  app.get('/health/live', async () => ({ status: 'live' }));
  app.get('/health/ready', async (_request, reply) => {
    let ready = false;
    try { ready = !draining && options.ready(); } catch { /* Failed local database probe. */ }
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'unavailable' });
  });
  app.addHook('onRequest', async (request, reply) => {
    if (draining && !['GET', 'HEAD'].includes(request.method)) return reply.code(503).send({ code: 'SERVICE_DRAINING' });
  });
  const lifecycle: ProductionLifecycle = {
    get draining() { return draining; },
    drain() {
      if (pending) return pending;
      draining = true;
      options.onDrain();
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          app.server.closeAllConnections();
          reject(new Error('Shutdown deadline exceeded'));
        }, options.timeoutMs ?? SHUTDOWN_BUDGET_MS);
      });
      pending = Promise.race([app.close(), deadline]).finally(() => clearTimeout(timer));
      return pending;
    },
  };
  lifecycles.set(app, lifecycle);
  return lifecycle;
}

export function drainProductionApp(app: FastifyInstance) {
  const lifecycle = lifecycles.get(app);
  if (!lifecycle) throw new Error('Production lifecycle unavailable');
  return lifecycle.drain();
}
