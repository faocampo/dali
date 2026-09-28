/** Test-only asset transport, shared by isolated services and child processes. */
import { request as httpRequest } from 'node:http';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';

/** Preserve both HTTP assets and dev HMR for each isolated synthetic service. */
export function proxyApplicationAssets(app: FastifyInstance, baseURL: string) {
  app.get('/*', async (request, reply) => { const response = await fetch(baseURL + request.url); return reply.type(response.headers.get('content-type') ?? 'text/html').send(Buffer.from(await response.arrayBuffer())); });
  // Dev assets retain Vite's HMR client. Forward its upgrade as well as HTTP
  // assets so the isolated origin exercises dev without hiding runtime errors.
  const upgradeSockets = new Set<Duplex>();
  app.server.on('upgrade', (request, socket, head) => {
    if (request.headers['sec-websocket-protocol'] !== 'vite-hmr') { socket.destroy(); return; }
    const target = new URL(request.url ?? '/', baseURL);
    upgradeSockets.add(socket);
    const upstream = httpRequest(target, { headers: { ...request.headers, host: target.host } });
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => { upgradeSockets.delete(socket); upstream.destroy(); });
    upstream.on('error', () => socket.destroy());
    upstream.on('response', response => { response.resume(); socket.destroy(); });
    upstream.on('upgrade', (response, peer, buffered) => {
      upgradeSockets.add(peer);
      peer.on('error', () => socket.destroy());
      peer.on('close', () => { upgradeSockets.delete(peer); socket.destroy(); });
      const headers = response.rawHeaders.reduce<string[]>((lines, value, index, all) => {
        if (index % 2 === 0) lines.push(`${value}: ${all[index + 1]}`);
        return lines;
      }, []);
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${headers.join('\r\n')}\r\n\r\n`);
      if (buffered.length) socket.write(buffered);
      if (head.length) peer.write(head);
      socket.pipe(peer).pipe(socket);
    });
    upstream.end();
  });
  return () => { for (const socket of upgradeSockets) socket.destroy(); };
}
