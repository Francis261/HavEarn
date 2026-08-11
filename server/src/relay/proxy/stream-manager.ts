import net from 'node:net';
import { WebSocket } from 'ws';
import type { ClientFrame } from '../protocol.js';
import type { DeviceRegistry } from '../relay-server.js';
import { config } from '../../config.js';

// ---------------------------------------------------------------------------
// Relay core shared by the SOCKS5 and HTTP-CONNECT listeners.
//
// Upstream streams the relay <-> phone over WebSocket. The phone dials the
// target outbound (its residential IP). Bytes are relayed as base64 "dndata"
// frames in both directions (uniform across Expo Go and dev-build transports).
// ---------------------------------------------------------------------------

export interface RelayStream {
  streamId: number;
  nodeId: string;
  ws: WebSocket;
  buyerSocket: net.Socket;
  sentBytes: number;
  receivedBytes: number;
  closed: boolean;
  ready: boolean;
  pendingQueue: Buffer[];
  onReady?: () => void;
}

const MAX_PENDING = 4 * 1024 * 1024;

export class StreamManager {
  private live = new Map<number, RelayStream>();
  private byNode = new Map<string, Set<number>>();
  private nodeBytes = new Map<string, number>();
  private nextId = 1;

  constructor(private registry: DeviceRegistry) {}

  relayCount(): number {
    return this.live.size;
  }

  drainBytes(nodeId: string): number {
    const v = this.nodeBytes.get(nodeId) ?? 0;
    this.nodeBytes.set(nodeId, 0);
    return v;
  }

  /** Drain and reset accounting for every node that relayed traffic. */
  drainAll(): Map<string, number> {
    const out = new Map<string, number>();
    for (const [nodeId, bytes] of this.nodeBytes) {
      if (bytes > 0) out.set(nodeId, bytes);
    }
    this.nodeBytes.clear();
    return out;
  }

  addMetricsOnly(nodeId: string, bytes: number): void {
    this.nodeBytes.set(nodeId, (this.nodeBytes.get(nodeId) ?? 0) + bytes);
  }

  /** Open an upstream stream and ask the phone to dial `target`. */
  open(
    nodeId: string,
    target: string,
    buyerSocket: net.Socket,
    onReady?: () => void,
  ): RelayStream | null {
    const ws = this.registry.get(nodeId);
    if (!ws) return null;

    // Enforce per-node connection limit to protect device bandwidth and
    // prevent a single node being monopolized / abused.
    const nodeStreams = this.byNode.get(nodeId);
    if (nodeStreams && nodeStreams.size >= config.maxStreamsPerNode) return null;

    const streamId = this.nextId++;
    const stream: RelayStream = {
      streamId,
      nodeId,
      ws,
      buyerSocket,
      sentBytes: 0,
      receivedBytes: 0,
      closed: false,
      ready: false,
      pendingQueue: [],
    };
    if (onReady) stream.onReady = onReady;

    this.live.set(streamId, stream);
    const set = this.byNode.get(nodeId) ?? new Set<number>();
    set.add(streamId);
    this.byNode.set(nodeId, set);

    buyerSocket.on('data', (chunk: Buffer) => this.pushBuyerData(stream, chunk));
    buyerSocket.on('close', () => this.closeStream(stream, 'buyer closed'));
    buyerSocket.on('error', () => this.closeStream(stream, 'buyer error'));

    this.sendToNode(stream, { type: 'conn', streamId, target });
    return stream;
  }

  /** Buyer bytes from the socket handler, or pre-open leftovers forwarded by a listener. */
  pushBuyerData(stream: RelayStream, chunk: Buffer): void {
    if (stream.closed || chunk.length === 0) return;
    if (stream.ready) {
      this.sendToNode(stream, chunk);
      return;
    }
    const buffered = stream.pendingQueue.reduce((a, b) => a + b.length, 0);
    if (buffered + chunk.length > MAX_PENDING) {
      this.closeStream(stream, 'pending buffer overflow');
      return;
    }
    stream.pendingQueue.push(chunk);
  }

  onNodeOffline(nodeId: string): void {
    const ids = this.byNode.get(nodeId);
    if (!ids) return;
    for (const id of Array.from(ids)) {
      const s = this.live.get(id);
      if (s) this.closeStream(s, 'node offline');
    }
    this.byNode.delete(nodeId);
  }

  /** Control frames forwarded from the relay server (never hello/ping). */
  onClientFrame(nodeId: string, frame: ClientFrame): void {
    if (
      frame.type !== 'ready' &&
      frame.type !== 'dndata' &&
      frame.type !== 'dnserr' &&
      frame.type !== 'dialerr' &&
      frame.type !== 'closing'
    ) {
      return;
    }
    const stream = this.live.get(frame.streamId);
    if (!stream || stream.closed) return;

    switch (frame.type) {
      case 'ready':
        stream.ready = true;
        stream.onReady?.();
        for (const chunk of stream.pendingQueue.splice(0)) {
          if (stream.closed) break;
          this.sendToNode(stream, chunk);
        }
        return;
      case 'dndata': {
        const buf = Buffer.from(frame.data, 'base64');
        if (buf.length) {
          stream.receivedBytes += buf.length;
          this.nodeBytes.set(nodeId, (this.nodeBytes.get(nodeId) ?? 0) + buf.length);
          try {
            stream.buyerSocket.write(buf);
          } catch {
            this.closeStream(stream, 'buyer write error');
          }
        }
        return;
      }
      case 'dnserr':
      case 'dialerr':
      case 'closing':
        this.closeStream(stream, frame.reason ?? 'dial failed');
        return;
      default:
        return;
    }
  }

  /** Binary chunks from the phone (kept for the future native TCP transport). */
  onClientData(nodeId: string, data: Buffer): void {
    this.addMetricsOnly(nodeId, data.length);
  }

  closeStream(stream: RelayStream, reason = 'eof'): void {
    if (stream.closed) return;
    stream.closed = true;
    this.live.delete(stream.streamId);
    const set = this.byNode.get(stream.nodeId);
    if (set) {
      set.delete(stream.streamId);
      if (set.size === 0) this.byNode.delete(stream.nodeId);
    }
    try {
      stream.buyerSocket.destroy();
    } catch {
      /* ignore */
    }
    this.sendToNode(stream, { type: 'closing', streamId: stream.streamId, reason });
  }

  private sendToNode(stream: RelayStream, payload: Buffer | OutFrame): void {
    if (stream.ws.readyState !== WebSocket.OPEN) {
      this.closeStream(stream, 'node disconnected');
      return;
    }
    if (Buffer.isBuffer(payload)) {
      stream.sentBytes += payload.length;
      this.nodeBytes.set(stream.nodeId, (this.nodeBytes.get(stream.nodeId) ?? 0) + payload.length);
      stream.ws.send(
        JSON.stringify({ type: 'dndata', streamId: stream.streamId, data: payload.toString('base64') }),
      );
    } else {
      stream.ws.send(JSON.stringify(payload));
    }
  }
}

type OutFrame =
  | { type: 'conn'; streamId: number; target: string }
  | { type: 'closing'; streamId: number; reason?: string };