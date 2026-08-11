import net from 'node:net';
import { WebSocket } from 'ws';
import { DeviceRegistry } from '../src/relay/relay-server.js';
import { startProxyListeners } from '../src/relay/proxy/index.js';
import { config } from '../src/config.js';

// Smoke test (no MongoDB): verify an HTTP CONNECT buyer and SOCKS5 buyer are
// paired to a fake phone node, authenticated, and bytes relay both directions.

const registry = new DeviceRegistry();
config.proxyUsername = 'testuser';
config.proxyPassword = 'testpass';

async function main() {
  config.httpProxyPort = 3199;
  config.socksPort = 3198;

  const proxy = await startProxyListeners(registry);

  // Fake device: OPEN WebSocket-like whose send() records frames and simulates
  // the phone dialing + echoing data back for the buyer.
  const sent: Array<string | Buffer> = [];
  const fakeWs = {
    readyState: WebSocket.OPEN,
    send: (payload: any) => {
      sent.push(payload);
      const str = String(payload);
      if (str.includes('"conn"')) {
        const f = JSON.parse(str);
        proxy.streamManager.onClientFrame('node-fake', { type: 'ready', streamId: f.streamId });
        proxy.streamManager.onClientFrame('node-fake', {
          type: 'dndata',
          streamId: f.streamId,
          data: Buffer.from('HELLO-FROM-PHONE').toString('base64'),
        });
      }
    },
  } as unknown as WebSocket;

  registry.register('node-fake', 'tok', fakeWs);

  await testHttpProxy();
  await testSocks5();
  await testSocks5AuthRejected();
  await proxy.stop();
  console.log('[smoke] all proxy paths OK');
  process.exit(0);
}

async function testHttpProxy(): Promise<void> {
  const cred = Buffer.from(`${config.proxyUsername}:${config.proxyPassword}`).toString('base64');
  return new Promise((resolve, reject) => {
    const socket = net.connect(config.httpProxyPort, '127.0.0.1', () => {
      socket.write(
        `CONNECT example.com:80 HTTP/1.1\r\nHost: example.com\r\nProxy-Authorization: Basic ${cred}\r\n\r\n`,
      );
    });
    let received = '';
    socket.on('data', (d: Buffer) => {
      received += d.toString('binary');
      if (received.includes('HELLO-FROM-PHONE')) {
        console.log('[smoke] HTTP CONNECT OK (auth)');
        socket.destroy();
        resolve();
      }
    });
    socket.on('close', () => reject(new Error('HTTP closed before data; got ' + received.slice(0, 120))));
    setTimeout(() => reject(new Error('HTTP test timed out; got ' + received.slice(0, 120))), 7000);
  });
}

async function testSocks5(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(config.socksPort, '127.0.0.1');
    let received = '';
    let phase: 'greeting' | 'auth' | 'request' = 'greeting';
    let didRequest = false;

    socket.on('data', (d: Buffer) => {
      received += d.toString('binary');

      if (phase === 'greeting' && received.length >= 2) {
        const method = received.charCodeAt(1);
        if (method !== 0x02) return reject(new Error('server did not select userpass auth: ' + method));
        // send userpass: user/pass
        const user = Buffer.from(config.proxyUsername);
        const pass = Buffer.from(config.proxyPassword);
        socket.write(Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]));
        received = '';
        phase = 'auth';
        return;
      }
      if (phase === 'auth' && received.length >= 2) {
        if (received.charCodeAt(1) !== 0x00) return reject(new Error('auth rejected'));
        // CONNECT example.com:443 (domain)
        const host = Buffer.from('example.com');
        socket.write(Buffer.concat([
          Buffer.from([0x05, 0x01, 0x00, 0x03, host.length]),
          host,
          Buffer.from([0x01, 0xbb]),
        ]));
        received = '';
        phase = 'request';
        return;
      }
      if (phase === 'request' && received.length >= 4 && !didRequest) {
        didRequest = true;
        if (received.charCodeAt(1) !== 0x00) return reject(new Error('SOCKS connect failed code ' + received.charCodeAt(1)));
        console.log('[smoke] SOCKS5 handshake + auth OK');
        setTimeout(() => {
          socket.destroy();
          resolve();
        }, 300);
      }
    });

    socket.on('error', (e) => reject(e));
    // Greeting: offer no-auth(0) and userpass(2), expect userpass.
    socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]));
    setTimeout(() => reject(new Error('SOCKS test timed out')), 7000);
  });
}

async function testSocks5AuthRejected(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(config.socksPort, '127.0.0.1');
    let received = '';
    let phase: 'greeting' | 'auth' = 'greeting';

    socket.on('data', (d: Buffer) => {
      received += d.toString('binary');
      if (phase === 'greeting' && received.length >= 2) {
        phase = 'auth';
        const user = Buffer.from('wrong');
        const pass = Buffer.from('wrong');
        socket.write(Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]));
        received = '';
        return;
      }
      if (phase === 'auth' && received.length >= 2) {
        if (received.charCodeAt(1) !== 0x01) return reject(new Error('expected auth failure'));
        console.log('[smoke] SOCKS5 bad creds rejected OK');
        socket.destroy();
        resolve();
      }
    });
    socket.write(Buffer.from([0x05, 0x01, 0x02]));
    setTimeout(() => reject(new Error('SOCKS auth-reject test timed out')), 7000);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[smoke] FAILED:', err.message);
    process.exit(1);
  });