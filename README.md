# HavEarn

Earn passive income from your device's unused internet bandwidth, rewarded ads, and tasks — a HoneyGain-style system built with an **Expo (React Native) mobile app** and a **Node.js/Express VPS server** that turns connected phones into residential proxies.

## How it works

1. The mobile app opens an **outbound WebSocket tunnel** to the VPS relay. The phone never listens on an inbound port (no NAT/firewall issues).
2. The VPS exposes a **SOCKS5 proxy** and an **HTTP CONNECT proxy** to buyers, authenticated with proxy credentials.
3. When a buyer connects, the relay sends a `conn` frame over the tunnel; the **phone dials the target** (e.g. `example.com:443`) from its residential IP and relays bytes both directions.
4. Traffic is metered per node, converted to USD at the bandwidth rate, and credited to the user's wallet (integer cents, atomic ledger).

```
buyer ──SOCKS5/HTTP CONNECT──▶ VPS relay ──WebSocket tunnel──▶ phone app ──outbound TCP──▶ target site
        (proxy credentials)      (relay :8080)                 (device IP)       (residential IP)
```

## Repository layout

| Path | Description |
| --- | --- |
| `server/` | Express 5 + Mongoose + `ws` API and relay. API on `:4000`, device tunnel on `:8080`, SOCKS5 on `:1080`, HTTP proxy on `:3128`. |
| `mobile/` | Expo SDK 57 app (expo-router, TypeScript, Zustand). |

## Getting started

### Server

```bash
cd server
npm install
cp .env.example .env   # then set MONGODB_URI, JWT_SECRET, PROXY_PASSWORD, URLs
npm run dev            # tsx watch
```

MongoDB must be reachable (default `mongodb://127.0.0.1:27017/havearn`). Seed content with `npm run seed`.

### Mobile

```bash
cd mobile
npm install
npx expo start
```

**Important:** real bandwidth sharing uses `react-native-tcp-socket`, which requires a **development build** (`npx expo run:android` / `npx expo run:ios`). In Expo Go the tunnel works but outbound TCP dialing is unavailable, so proxy connections report a `dialerr`/`unavailable` reply. AdMob (`react-native-google-mobile-ads`) also requires a dev build — it currently uses test ad units.

## Configuration (server `.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API server |
| `RELAY_PORT` | `8080` | Device WebSocket tunnel |
| `SOCKS_PORT` / `HTTP_PROXY_PORT` | `1080` / `3128` | Buyer proxy listeners |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/havearn` | Database |
| `JWT_SECRET` | `dev-secret-do-not-use` | Auth signing (set a real one) |
| `PROXY_USERNAME` / `PROXY_PASSWORD` | `havearn` / `change-me-now` | Buyer-side proxy credentials (SOCKS5 userpass / HTTP Basic) |
| `BANDWIDTH_RATE_PER_GB` | `10` | USD per GB credited to nodes |
| `AD_REWARD_CENTS` / `AD_DAILY_CAP` | `5` / `100` | Reward per rewarded ad and daily cap |
| `TASK_BASE_REWARD_CENTS` | `50` | Reward for completing a task |
| `REFERRAL_REWARD_CENTS` | `250` | Signup referral bonus |
| `MIN_WITHDRAWAL_CENTS` | `500` | Minimum withdrawal amount |
| `API_BASE_URL` / `RELAY_WS_URL` | `http://localhost:4000` / `ws://localhost:8080` | URLs advertised to clients |
| `MAX_STREAMS_PER_NODE` / `MAX_RELAY_CONNECTIONS` | `20` / `500` | Relay abuse limits |
| `ADMIN_EMAILS` | (empty) | Comma-separated admin accounts |

## API surface (all under `/api` unless noted)

- **Auth** — `POST /auth/signup`, `POST /auth/signin`, `GET /auth/me`, `GET /auth/transactions`
- **Terms** — `GET /terms/current`, `POST /terms/accept`
- **Tasks** — `GET /tasks`, `POST /tasks/:id/complete`
- **Ads** — `POST /ads/start`, `POST /ads/complete` (nonce-verified, daily-capped)
- **Withdrawals** — `GET /withdrawals`, `GET /withdrawals/methods`, `POST /withdrawals`
- **Relay nodes** — `POST /relay-nodes/register` (returns the node token + tunnel URL)
- **Admin** (requires `ADMIN_EMAILS`) — `GET /admin/users/summary`, `GET /admin/withdrawals`, `POST /admin/tasks`, `POST /admin/withdrawals/:id/decide`, `POST /admin/withdrawals/:id/paid`
- **Legal** — `GET /legal/privacy`
- `GET /health` on the API root

## Proxy/relay protocol

The device relay protocol lives in `server/src/relay/protocol.ts`. Frames are JSON text messages over the tunnel WebSocket; traffic is relayed as base64 `dndata` frames (uniform across the Expo Go and dev-build transports):

- `hello` / `ok` — tunnel handshake (per-node token auth, protocol version check)
- `conn` / `ready` / `dialerr` / `dnserr` — ask the phone to dial a target and report success/failure
- `dndata` — base64 traffic in both directions
- `closing` — stream teardown
- `ping` / `pong` — liveness (server pings every 40s)

SOCKS5 implements RFC 1929 userpass auth; the HTTP proxy requires Basic `Proxy-Authorization`. Both enforce per-node stream and global connection caps.

Run the relay smoke test (no MongoDB required) with:

```bash
cd server
node --import tsx/esm scripts/relay-smoke.ts
```

## License

MIT — see `LICENSE`.
