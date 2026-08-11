import http from 'node:http';
import { AddressInfo } from 'node:net';
import { connectDb } from './db.js';
import { config } from './config.js';
import { createApp } from './app.js';
import { DeviceRegistry, startRelayServer } from './relay/relay-server.js';
import { startProxyListeners } from './relay/proxy/index.js';

async function main(): Promise<void> {
  await connectDb(config.mongodbUri);

  const registry = new DeviceRegistry();

  // API server (port 4000)
  const apiServer = http.createServer(createApp());
  await new Promise<void>((resolve) => apiServer.listen(config.port, resolve));
  const apiAddr = apiServer.address() as AddressInfo;
  console.log(`[api]  http+ws : ${config.port} (${apiAddr.address}:${apiAddr.port})`);

  // Tunnel server (port 8080) - device WebSockets
  const relayServer = http.createServer((_req, res) => res.writeHead(426).end());

  // Proxy listeners must exist before relay frames arrive so streams can pair.
  const proxy = await startProxyListeners(registry);
  startRelayServer(relayServer, registry, proxy.streamManager);

  await new Promise<void>((resolve) => relayServer.listen(config.relayPort, resolve));
  console.log(`[relay] tunnel ws : ${config.relayPort}`);

  const shutdown = async () => {
    console.log('\n[server] shutting down');
    await Promise.all([
      new Promise<void>((r) => apiServer.close(() => r())),
      new Promise<void>((r) => relayServer.close(() => r())),
      proxy.stop(),
    ]).catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[server] fatal', err);
  process.exit(1);
});