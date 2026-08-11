// Frame protocol between the mobile device client and the VPS relay.
// All client->server and server->client messages are JSON text frames.
// Data payloads are sent as binary frames preceded by a "ctrl" frame.

export type ClientFrame =
  | { type: 'hello'; nodeId: string; token: string; version: number; device: string }
  | { type: 'ready'; streamId: number }
  | { type: 'dndata'; streamId: number; data: string } // base64 chunk from phone -> relay
  | { type: 'dnserr' | 'dialerr' | 'closing'; streamId: number; reason?: string }
  | { type: 'ping'; t: number };

export type ServerFrame =
  | { type: 'ok'; echo?: string }
  | { type: 'err'; code: string; message: string }
  | { type: 'conn'; streamId: number; target: string }
  | { type: 'dndata'; streamId: number; data: string } // base64 chunk to forward to buyer
  | { type: 'closing'; streamId: number; reason?: string }
  | { type: 'pong'; t: number }
  | { type: 'metrics'; totalBytes: number };

export interface UpstreamConnection {
  streamId: number;
  sock: import('net').Socket;
  sentBytes: number;
  receivedBytes: number;
  closed: boolean;
  bytesWrittenBase: number;
}

export const PROTOCOL_VERSION = 1;