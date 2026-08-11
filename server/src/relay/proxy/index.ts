import net from 'node:net';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { DeviceRegistry } from '../relay-server.js';
import { StreamManager } from './stream-manager.js';
import { config } from '../../config.js';
import { creditBandwidth } from '../../services/bandwidth.js';

export interface ProxyHandle {
  socks?: net.Server;
  http?: net.Server;
  streamManager: StreamManager;
  stop: () => Promise<void>;
}

function secureEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function authOk(user: string, pass: string): boolean {
  return secureEqual(user, config.proxyUsername) && secureEqual(pass, config.proxyPassword);
}

const SOCKS_GENERAL_FAILURE = Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]);

/**
 * Starts the SOCKS5 and HTTP CONNECT proxy listeners. Buyers hit these ports,
 * the relay pairs each connection with an online phone, and the phone's
 * residential IP egresses the traffic. Both listeners require credentials so
 * the relay cannot be used by strangers.
 */
export async function startProxyListeners(registry: DeviceRegistry): Promise<ProxyHandle> {
  const streamManager = new StreamManager(registry);

  // Bandwidth accounting flush (every 15s).
  const flush = setInterval(async () => {
    const totals = streamManager.drainAll();
    for (const [nodeId, bytes] of totals) {
      await creditBandwidth(nodeId, bytes).catch((err) =>
        console.warn('[relay] bandwidth credit failed', err.message),
      );
    }
  }, 15_000);

  const socks = createSocksServer(registry, streamManager);
  const httpProxy = createHttpProxyServer(registry, streamManager);

  await new Promise<void>((resolve) => socks.listen(config.socksPort, resolve));
  await new Promise<void>((resolve) => httpProxy.listen(config.httpProxyPort, resolve));

  console.log(`[relay] SOCKS5 proxy     : ${config.socksPort} (userpass auth)`);
  console.log(`[relay] HTTP CONNECT proxy: ${config.httpProxyPort} (Basic auth)`);

  return {
    socks,
    http: httpProxy,
    streamManager,
    stop: async () => {
      clearInterval(flush);
      for (const srv of [socks, httpProxy]) await new Promise<void>((r) => srv.close(() => r()));
    },
  };
}

/** Guard a listener so it can't be used to exhaust resources before auth. */
function withGlobalCap(handler: (socket: net.Socket) => void): (socket: net.Socket) => void {
  let active = 0;
  return (socket) => {
    if (active >= config.maxRelayConnections) {
      socket.destroy();
      return;
    }
    active++;
    socket.on('close', () => {
      active--;
    });
    handler(socket);
  };
}

// ---------------------------------------------------------------------------
// SOCKS5 (RFC 1928) with username/password auth (RFC 1929). CONNECT only.
// ---------------------------------------------------------------------------
function createSocksServer(registry: DeviceRegistry, m: StreamManager): net.Server {
  return net.createServer(
    withGlobalCap((socket) => {
      let buf = Buffer.alloc(0);
      let opened = false;
      // phase: 'greeting' -> 'auth' -> 'request' | 'failed'
      let phase: 'greeting' | 'auth' | 'request' = 'greeting';

      const fail = () => {
        socket.write(SOCKS_GENERAL_FAILURE);
        socket.destroy();
      };

      const replyFailure = (code: number) => {
        socket.write(Buffer.from([0x05, code, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        socket.destroy();
      };

      socket.on('data', (chunk: Buffer) => {
        if (opened) return; // stream manager owns the socket
        buf = Buffer.concat([buf, chunk]);
        if (buf.length > 512) {
          socket.destroy();
          return;
        }

        if (phase === 'greeting') {
          if (buf.length < 2 || buf[0] !== 0x05) return socket.destroy();
          const nMethods = buf[1];
          if (buf.length < 2 + nMethods) return;
          const methods = [...buf.subarray(2, 2 + nMethods)];
          if (methods.includes(0x02)) {
            // offer userpass auth
            socket.write(Buffer.from([0x05, 0x02]));
            phase = 'auth';
          } else if (methods.includes(0x00) && !config.proxyPassword) {
            socket.write(Buffer.from([0x05, 0x00]));
            phase = 'request';
          } else {
            socket.write(Buffer.from([0x05, 0xff]));
            socket.destroy();
            return;
          }
          buf = buf.subarray(2 + nMethods);
          if (buf.length === 0) return;
        }

        if (phase === 'auth') {
          if (buf.length < 2 || buf[0] !== 0x01) {
            socket.destroy();
            return;
          }
          const ulen = buf[1];
          if (buf.length < 2 + ulen + 1) return;
          const plen = buf[2 + ulen];
          if (buf.length < 2 + ulen + 1 + plen) return;
          const user = buf.subarray(2, 2 + ulen).toString();
          const pass = buf.subarray(2 + ulen + 1, 2 + ulen + 1 + plen).toString();
          buf = buf.subarray(2 + ulen + 1 + plen);

          if (!authOk(user, pass)) {
            socket.write(Buffer.from([0x01, 0x01]));
            socket.destroy();
            return;
          }
          socket.write(Buffer.from([0x01, 0x00]));
          phase = 'request';
          if (buf.length === 0) return;
        }

        if (phase === 'request') {
          if (buf.length < 4 || buf[0] !== 0x05) {
            fail();
            return;
          }
          const cmd = buf[1];
          if (cmd !== 0x01) {
            replyFailure(0x07); // command not supported
            return;
          }
          const atyp = buf[3];
          let target: string;
          let consumed: number;
          if (atyp === 0x01) {
            if (buf.length < 10) return;
            target = `${[...buf.subarray(4, 8)].join('.')}:${buf.readUInt16BE(8)}`;
            consumed = 10;
          } else if (atyp === 0x03) {
            const len = buf[4];
            if (buf.length < 5 + len + 2) return;
            target = `${buf.subarray(5, 5 + len).toString()}:${buf.readUInt16BE(5 + len)}`;
            consumed = 5 + len + 2;
          } else {
            replyFailure(0x08); // address type not supported
            return;
          }

          const nodeId = registry.pickNodeId();
          if (!nodeId) {
            replyFailure(0x01); // general failure
            return;
          }

          const stream = m.open(nodeId, target, socket, () => {
            socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          });
          if (!stream) {
            replyFailure(0x01);
            return;
          }

          opened = true;

          const leftover = buf.subarray(consumed);
          if (leftover.length) m.pushBuyerData(stream, leftover);
        }
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// HTTP CONNECT proxy (RFC 7231 §4.3.6) with Basic auth via Proxy-Authorization.
// ---------------------------------------------------------------------------
function createHttpProxyServer(registry: DeviceRegistry, m: StreamManager): net.Server {
  const challenge = `Basic realm="HavEarn relay"`;
  return net.createServer(
    withGlobalCap((socket) => {
      let buf = Buffer.alloc(0);
      let opened = false;

      socket.on('data', (chunk: Buffer) => {
        if (opened) return;
        buf = Buffer.concat([buf, chunk]);
        if (buf.length > 64 * 1024) {
          socket.destroy();
          return;
        }

        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;

        const head = buf.subarray(0, idx).toString();
        const lines = head.split('\r\n');
        const reqLine = lines[0] ?? '';
        const mch = reqLine.match(/^CONNECT\s+([^:\s]+):(\d+)\s+HTTP\/1\.[01]$/i);
        if (!mch) {
          socket.write('HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n');
          socket.destroy();
          return;
        }

        // Authorization check (Proxy-Authorization preferred, fall back to Authorization).
        const proxyAuth = lines
          .find((l) => /^proxy-authorization:/i.test(l))
          ?.replace(/^proxy-authorization:/i, '')
          .trim();
        const authorization = lines
          .find((l) => /^authorization:/i.test(l))
          ?.replace(/^authorization:/i, '')
          .trim();

        const cred = proxyAuth ?? authorization;
        if (!config.proxyPassword && !cred) {
          // No password configured: allow unauthenticated (dev only).
        } else if (!cred || !basicAuthOk(cred)) {
          socket.write(
            `HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: ${challenge}\r\nContent-Length: 0\r\n\r\n`,
          );
          socket.destroy();
          return;
        }

        const target = `${mch[1]}:${mch[2]}`;
        const nodeId = registry.pickNodeId();
        if (!nodeId) {
          socket.write('HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n');
          socket.destroy();
          return;
        }

        const stream = m.open(nodeId, target, socket, () => {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        });
        if (!stream) {
          socket.write('HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n');
          socket.destroy();
          return;
        }

        opened = true;

        // ClientHello etc. sent immediately after CONNECT must be preserved.
        const leftover = buf.subarray(idx + 4);
        if (leftover.length) m.pushBuyerData(stream, leftover);
      });
    }),
  );
}

function basicAuthOk(header: string): boolean {
  const m = header.match(/^Basic\s+(.+)$/i);
  if (!m) return false;
  try {
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep === -1) return false;
    return authOk(decoded.slice(0, sep), decoded.slice(sep + 1));
  } catch {
    return false;
  }
}