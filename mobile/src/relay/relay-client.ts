import { useRelay } from '@/state/relay';
import type { RelayNode } from '@/types';
import { bytesToBase64, base64ToBytes, dialTarget, parseTarget, DialError, type DialedSocket } from './transport';

export const PROTOCOL_VERSION = 1;

interface ServerFrame {
  type: string;
  streamId?: number;
  target?: string;
  data?: string;
  reason?: string;
  t?: number;
}

/**
 * Outbound tunnel to the VPS relay. The phone never opens an inbound port: it
 * dials out via WebSocket, and when the relay receives a buyer connection it
 * frames a `conn` request here. This client dials the requested target from
 * the device's residential IP and relays bytes both directions.
 */
export class RelayClient {
  private ws: WebSocket | null = null;
  private node: RelayNode | null = null;
  private tunnelUrl = '';
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private stopRequested = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1_000;
  private streams = new Map<number, DialedSocket>();

  start(node: RelayNode, tunnelUrl: string): void {
    this.node = node;
    this.tunnelUrl = tunnelUrl;
    this.stopRequested = false;
    this.reconnectDelay = 1_000;
    useRelay.getState().resetSession();
    this.connect();
  }

  stop(): void {
    this.stopRequested = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.teardownStreams('client stop');
    if (this.ws) {
      try {
        this.ws.close(1000, 'client stop');
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
    useRelay.getState().setStatus('idle');
  }

  private teardownStreams(reason: string): void {
    for (const stream of Array.from(this.streams.values())) {
      try {
        stream.destroy();
      } catch {
        /* ignore */
      }
    }
    this.streams.clear();
    void reason;
  }

  private connect(): void {
    if (this.stopRequested || !this.node) return;
    useRelay.getState().setStatus('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.tunnelUrl);
    } catch (err) {
      useRelay.getState().setStatus('error', String(err));
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    this.teardownStreams('reconnecting');

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'hello',
          nodeId: this.node!.id,
          token: this.node!.token,
          version: PROTOCOL_VERSION,
          device: 'android-js',
        }),
      );
    };

    ws.onerror = () => {
      if (useRelay.getState().status === 'connected') {
        useRelay.getState().setStatus('error', 'Relay connection error');
      }
    };

    ws.onclose = (event) => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      this.teardownStreams('tunnel closed');
      useRelay.getState().setStatus('error', event.reason || 'Disconnected');
      this.scheduleReconnect();
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        let frame: ServerFrame;
        try {
          frame = JSON.parse(event.data);
        } catch {
          return;
        }
        this.handleFrame(ws, frame);
        return;
      }
      // Binary frames are reserved for the future native TCP transport; the
      // current protocol carries all data as base64 "dndata" frames.
    };
  }

  private handleFrame(ws: WebSocket, frame: ServerFrame): void {
    switch (frame.type) {
      case 'ok':
        useRelay.getState().setStatus('connected');
        this.reconnectDelay = 1_000;
        this.startHeartbeat(ws);
        break;

      case 'conn':
        this.onConnRequest(ws, frame.streamId ?? 0, frame.target ?? '');
        break;

      case 'dndata': {
        const streamId = frame.streamId ?? 0;
        const socket = this.streams.get(streamId);
        if (!socket) return;
        const bytes = base64ToBytes(frame.data ?? '');
        if (bytes.length) {
          try {
            socket.write(bytes);
          } catch {
            this.closeStream(streamId, 'socket write error');
          }
        }
        break;
      }

      case 'closing': {
        const streamId = frame.streamId ?? 0;
        this.closeStream(streamId, frame.reason ?? 'buyer disconnected');
        break;
      }

      case 'pong':
      case 'metrics':
        break;

      default:
        break;
    }
  }

  private onConnRequest(ws: WebSocket, streamId: number, target: string): void {
    const parsed = parseTarget(target);
    if (!parsed) {
      this.safeSend(ws, { type: 'dialerr', streamId, reason: 'bad target' });
      return;
    }

    dialTarget(parsed.host, parsed.port)
      .then((socket) => {
        if (this.stopRequested || this.streams.has(streamId)) {
          socket.destroy();
          return;
        }
        this.streams.set(streamId, socket);

        socket.onError((_err) => {
          const s = this.streams.get(streamId);
          if (s) this.closeStream(streamId, 'socket error');
        });
        socket.onClose(() => {
          this.closeStream(streamId, 'socket closed');
        });
        socket.onData((chunk) => {
          if (chunk.length === 0) return;
          useRelay.getState().addBytes(chunk.length);
          this.safeSend(ws, {
            type: 'dndata',
            streamId,
            data: bytesToBase64(chunk),
          });
        });

        this.safeSend(ws, { type: 'ready', streamId });
      })
      .catch((err: unknown) => {
        const dialErr = err instanceof DialError ? err : new DialError('dialerr', String(err));
        this.safeSend(ws, { type: dialErr.kind === 'dnserr' ? 'dnserr' : 'dialerr', streamId, reason: dialErr.message });
      });
  }

  private closeStream(streamId: number, reason: string): void {
    const socket = this.streams.get(streamId);
    if (!socket) return;
    this.streams.delete(streamId);
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.safeSend(this.ws, { type: 'closing', streamId, reason });
    }
  }

  private safeSend(ws: WebSocket, frame: ServerFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame));
    }
  }

  private startHeartbeat(ws: WebSocket): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      }
    }, 30_000);
  }

  private scheduleReconnect(): void {
    if (this.stopRequested || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this.connect();
    }, this.reconnectDelay);
  }
}

export const relayClient = new RelayClient();