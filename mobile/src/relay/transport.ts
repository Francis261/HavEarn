import { Platform } from 'react-native';

export interface DialedSocket {
  write(data: Uint8Array | string): boolean;
  destroy(): void;
  onData: (cb: (data: Uint8Array) => void) => void;
  onClose: (cb: () => void) => void;
  onError: (cb: (err: unknown) => void) => void;
}

export type DialFailureKind = 'unavailable' | 'dnserr' | 'dialerr';

export class DialError extends Error {
  readonly kind: DialFailureKind;

  constructor(kind: DialFailureKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

let nativeState: boolean | null = null;

async function nativeTransportAvailable(): Promise<boolean> {
  if (nativeState !== null) return nativeState;
  if (Platform.OS === 'web') return (nativeState = false);
  try {
    await import('react-native-tcp-socket');
    return (nativeState = true);
  } catch {
    return (nativeState = false);
  }
}

/**
 * Dials `host:port` outbound from the device (its residential IP). Uses the
 * native TCP module in development/production builds. In Expo Go (no native
 * module) this resolves to `{ kind: 'unavailable' }`.
 */
export async function dialTarget(host: string, port: number): Promise<DialedSocket> {
  if (!(await nativeTransportAvailable())) {
    throw new DialError('unavailable', 'native TCP transport not available (Expo Go)');
  }

  const TcpSocket = (await import('react-native-tcp-socket')).default;

  return new Promise<DialedSocket>((resolve, reject) => {
    const client = TcpSocket.createConnection({ host, port }, () => {
      // connect callback fires on success
      clearTimeout(timer);
      resolve({
        write: (data) => client.write(data),
        destroy: () => client.destroy(),
        onData: (cb) => client.on('data', (d: string | Uint8Array) => {
          const bytes = typeof d === 'string' ? utf8toBytes(d) : d;
          if (bytes.length) cb(bytes);
        }),
        onClose: (cb) => client.on('close', () => cb()),
        onError: (cb) => client.on('error', (e: unknown) => cb(e)),
      });
    });

    const timer = setTimeout(() => {
      client.destroy();
      reject(new DialError('dialerr', `connect timeout for ${host}:${port}`));
    }, 20_000);

    client.on('error', (err: unknown) => {
      clearTimeout(timer);
      const reason = String((err as { message?: string })?.message ?? err);
      reject(new DialError('dnserr', reason));
    });
  });
}

// --- minimal base64 (avoids relying on Hermes btoa/atob) --------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8toBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += B64[(triple >> 18) & 0x3f] + B64[(triple >> 12) & 0x3f] + B64[(triple >> 6) & 0x3f] + B64[triple & 0x3f];
  }
  const pad = bytes.length % 3;
  if (pad === 1) out = out.slice(0, -2) + '==';
  else if (pad === 2) out = out.slice(0, -1) + '=';
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  let clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length % 4 === 1) clean = clean.slice(0, -1);
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const count = Math.floor((clean.length * 6) / 8) - padding;
  const out = new Uint8Array(count);
  let bits = 0;
  let acc = 0;
  let idx = 0;
  for (let i = 0; i < clean.length && idx < count; i++) {
    const c = clean[i];
    const val = c === '=' ? 0 : B64.indexOf(c);
    if (val === -1) continue;
    acc = (acc << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[idx++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

export function parseTarget(target: string): { host: string; port: number } | null {
  const idx = target.lastIndexOf(':');
  if (idx <= 0) return null;
  const host = target.slice(0, idx);
  const port = Number(target.slice(idx + 1));
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { host, port };
}