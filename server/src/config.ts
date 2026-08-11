import dotenv from 'dotenv';

dotenv.config();

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: int('PORT', 4000),
  relayPort: int('RELAY_PORT', 8080),
  socksPort: int('SOCKS_PORT', 1080),
  httpProxyPort: int('HTTP_PROXY_PORT', 3128),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/havearn',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-do-not-use',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  bandwidthRatePerGb: int('BANDWIDTH_RATE_PER_GB', 10),
  adRewardCents: int('AD_REWARD_CENTS', 5),
  adDailyCap: int('AD_DAILY_CAP', 100),
  adNonceTtlMs: 5 * 60 * 1000,
  taskBaseRewardCents: int('TASK_BASE_REWARD_CENTS', 50),
  referralRewardCents: int('REFERRAL_REWARD_CENTS', 250),
  minWithdrawalCents: int('MIN_WITHDRAWAL_CENTS', 500),

  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
  relayWsUrl: process.env.RELAY_WS_URL ?? 'ws://localhost:8080',

  // Buyer-side credentials for the SOCKS5/HTTP proxy listeners (prevents
  // unauthorized use of the relay). The phone's tunnel is authenticated by the
  // per-node token instead.
  proxyUsername: process.env.PROXY_USERNAME ?? 'havearn',
  proxyPassword: process.env.PROXY_PASSWORD ?? 'change-me-now',

  maxStreamsPerNode: int('MAX_STREAMS_PER_NODE', 20),
  maxRelayConnections: int('MAX_RELAY_CONNECTIONS', 500),
};
