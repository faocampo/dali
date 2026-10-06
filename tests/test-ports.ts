/** Optional isolation for another checkout's local fixture servers. */
const offset = Number(process.env.DALI_TEST_PORT_OFFSET ?? 0);
if (!Number.isSafeInteger(offset)) throw new Error('DALI_TEST_PORT_OFFSET must be an integer');
export function testPort(defaultPort: number): number {
  const port = defaultPort + offset;
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Test port is outside the unprivileged TCP range');
  return port;
}
export const testOrigin = (defaultPort: number) => `http://127.0.0.1:${testPort(defaultPort)}`;
