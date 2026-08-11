import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server } from 'node:http';
import { Node } from '../models/Node.js';
import { PROTOCOL_VERSION, type ClientFrame, type ServerFrame } from './protocol.js';
import type { StreamManager } from './proxy/stream-manager.js';

/**
 * Registry of live device nodes. A node is "online" once its WebSocket
 * connection completes the hello handshake. Used by the proxy listeners to
 * pick a residential exit for each buyer connection.
 */
export class DeviceRegistry {
  private connections = new Map<string, WebSocket>();
  private byToken = new Map<string, string>();
  private offlineHook: ((nodeId: string) => void) | null = null;

  onlineCount(): number {
    return this.connections.size;
  }

  setOfflineHook(hook: (nodeId: string) => void): void {
    this.offlineHook = hook;
  }

  register(nodeId: string, token: string, ws: WebSocket): void {
    this.byToken.set(token, nodeId);
    this.connections.set(nodeId, ws);
  }

  /** Close any existing tunnel for a node (replaces a stale connection). */
  kick(nodeId: string): void {
    const ws = this.connections.get(nodeId);
    if (ws && ws !== this.connections.get(nodeId)) return; // already replaced
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.close(4002, 'replaced by new connection');
      } catch {
        /* ignore */
      }
    }
    this.connections.delete(nodeId);
  }

  unregister(ws: WebSocket): string | null {
    let nodeId: string | null = null;
    for (const [id, conn] of this.connections) {
      if (conn === ws) {
        nodeId = id;
        break;
      }
    }
    if (nodeId) {
      this.connections.delete(nodeId);
      for (const [token, id] of this.byToken) if (id === nodeId) this.byToken.delete(token);
      this.offlineHook?.(nodeId);
    }
    return nodeId;
  }

  pick(): WebSocket | null {
    for (const [, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) return ws;
    }
    return null;
  }

  pickNodeId(): string | null {
    for (const id of this.connections.keys()) {
      const ws = this.connections.get(id);
      if (ws && ws.readyState === WebSocket.OPEN) return id;
    }
    return null;
  }

  get(nodeId: string): WebSocket | undefined {
    const ws = this.connections.get(nodeId);
    return ws && ws.readyState === WebSocket.OPEN ? ws : undefined;
  }

  raw(nodeId: string): WebSocket | undefined {
    return this.connections.get(nodeId);
  }

  nodeIds(): string[] {
    return Array.from(this.connections.keys());
  }
}

interface PongState {
  __missedPongs?: number;
}

export interface RelayDispatch {
  onClientFrame(nodeId: string, frame: ClientFrame): void;
  onClientData(nodeId: string, data: Buffer): void;
  onNodeOffline(nodeId: string): void;
}

/** The WebSocket tunnel listener. Devices authenticate with {nodeId, token} in
 * the hello frame, then exchange relay frames. Relay frames are forwarded to
 * the StreamManager dispatcher.
 */
export function startRelayServer(
  server: Server,
  registry: DeviceRegistry,
  dispatch: RelayDispatch,
): WebSocketServer {
  const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 * 1024 });

  registry.setOfflineHook((nodeId) => dispatch.onNodeOffline(nodeId));

  // Liveness: WS-level ping every 40s. A node that misses two consecutive
  // pongs is considered dead and dropped.
  const liveness = setInterval(() => {
    for (const nodeId of registry.nodeIds()) {
      const ws = registry.raw(nodeId);
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;
      const pongs = (ws as PongState).__missedPongs ?? 0;
      if (pongs >= 2) {
        ws.close(4005, 'no pong');
        continue;
      }
      (ws as PongState).__missedPongs = ((ws as PongState).__missedPongs ?? 0) + 1;
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }, 40_000);

  wss.on('connection', (ws) => {
    let currentNodeId: string | null = null;
    let helloTimer: NodeJS.Timeout | null = null;

    (ws as PongState).__missedPongs = 0;
    ws.on('pong', () => {
      (ws as PongState).__missedPongs = 0;
    });

    helloTimer = setTimeout(() => ws.close(4001, 'hello timeout'), 10_000);

    ws.on('message', async (raw) => {
      if (!(raw instanceof Buffer) && typeof raw !== 'string') return;

      let frame: ClientFrame;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        // Binary data chunk forwarded to the stream manager.
        if (currentNodeId) dispatch.onClientData(currentNodeId, raw as Buffer);
        return;
      }

      switch (frame.type) {
        case 'hello': {
          if (frame.version !== PROTOCOL_VERSION) {
            ws.close(4003, 'protocol version mismatch');
            return;
          }
          if (helloTimer) {
            clearTimeout(helloTimer);
            helloTimer = null;
          }
          const node = await Node.findOne({
            _id: frame.nodeId,
            token: frame.token,
            status: { $ne: 'disabled' },
          }).lean();
          if (!node) {
            ws.close(4004, 'invalid credentials');
            return;
          }
          // Reconnect handling: a second tunnel for the same node replaces the
          // stale one so the device doesn't end up with two live exits.
          const previous = registry.raw(String(node._id));
          if (previous && previous !== ws && previous.readyState === WebSocket.OPEN) {
            previous.close(4002, 'replaced by new connection');
          }
          currentNodeId = String(node._id);
          registry.register(currentNodeId, node.token, ws);
          await Node.updateOne({ _id: node._id }, { status: 'online', lastSeenAt: new Date() });
          send(ws, { type: 'ok' });
          return;
        }
        case 'ping':
          send(ws, { type: 'pong', t: frame.t ?? Date.now() });
          return;
        default:
          if (currentNodeId) dispatch.onClientFrame(currentNodeId, frame);
          return;
      }
    });

    ws.on('close', async () => {
      const nodeId = registry.unregister(ws);
      if (nodeId) {
        await Node.updateOne({ _id: nodeId }, { status: 'offline', lastSeenAt: new Date() });
      }
    });

    ws.on('error', () => ws.close());
  });

  wss.on('listening', () => console.log('[relay] tunnel ws listening'));

  const stopLiveness = () => clearInterval(liveness);
  wss.on('close', stopLiveness);
  process.on('beforeExit', stopLiveness);

  return wss;
}

function send(ws: WebSocket, frame: ServerFrame): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

export { createServer };
export type { Server as HttpServer };