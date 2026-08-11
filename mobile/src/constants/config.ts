export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const RELAY_WS_URL =
  process.env.EXPO_PUBLIC_RELAY_WS_URL ?? 'ws://localhost:8080';

export const AD_UNIT_REWARDED = {
  // Google sample rewarded ad unit ids (test mode). Replace with your own.
  android: 'ca-app-pub-3940256099942544/5224354917',
  ios: 'ca-app-pub-3940256099942544/1712485313',
} as const;
