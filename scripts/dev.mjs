/** Local development supervisor; never imported by production entrypoints. */
import { spawn } from 'node:child_process';

let child;
let runtime;
let stopping = false;
const stop = (code) => {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  // Bound shutdown even when compilation or a service stops responding.
  setTimeout(() => { child?.kill('SIGKILL'); process.exit(code); }, 10_000).unref();
  child?.kill('SIGTERM');
  void runtime?.close();
};
process.once('SIGINT', () => stop(130));
process.once('SIGTERM', () => stop(143));

try {
  if (process.env.NODE_ENV === 'production') throw new Error('Synthetic local development requires a non-production environment.');
  await new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.dev.json'], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => { child = undefined; code === 0 ? resolve() : reject(new Error('Local development compilation failed.')); });
  });
  if (!stopping) {
    const { startLocalDevelopment, readDevOptions } = await import('../.gsd/dev-build/scripts/dev-server.js');
    runtime = await startLocalDevelopment(readDevOptions(process.argv.slice(2), process.env), () => stopping);
    if (stopping) await runtime.close();
    else {
      console.log(`Dali local development ready: ${runtime.origin}`);
      console.log('Synthetic sign-in only. Choose a synthetic account; local boards and sessions survive a normal restart.');
      console.log('Press Ctrl+C to stop all local services.');
      await runtime.closed;
    }
  }
} catch (error) {
  if (!stopping) {
    console.error(error instanceof Error ? error.message : 'Local development startup failed.');
    process.exitCode = 1;
  }
} finally {
  await runtime?.close();
}
