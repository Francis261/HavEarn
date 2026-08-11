import { Platform } from 'react-native';
import { AD_UNIT_REWARDED } from '@/constants/config';
import type { Adapter } from './types';

/**
 * AdMob rewarded ads via react-native-google-mobile-ads (requires a dev build /
 * EAS build — not available in Expo Go or on web).
 */
let loadAds: (() => {
  RewardedAd: any;
  AdEventType: any;
  RewardedAdEventType: any;
}) | null = null;

function getAdsLoader() {
  if (!loadAds) {
    loadAds = () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('react-native-google-mobile-ads');
      return mod as {
        RewardedAd: any;
        AdEventType: any;
        RewardedAdEventType: any;
      };
    };
  }
  return loadAds;
}

export const adMobAdapter: Adapter = {
  available: Platform.OS === 'android' || Platform.OS === 'ios',

  show() {
    if (!adMobAdapter.available) {
      return Promise.reject(new Error('AdMob is unavailable on this platform'));
    }

    const { RewardedAd, AdEventType, RewardedAdEventType } = getAdsLoader()();
    const unitId = Platform.OS === 'ios' ? AD_UNIT_REWARDED.ios : AD_UNIT_REWARDED.android;
    const rewarded = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const finish = (ok: boolean, err?: Error) => {
        if (settled) return;
        settled = true;
        rewarded.removeAllListeners();
        if (err) reject(err);
        else resolve(ok);
      };

      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => finish(true));
      rewarded.addAdEventListener(AdEventType.ERROR, (error: { message?: string }) =>
        finish(false, new Error(error?.message ?? 'Ad error')),
      );
      rewarded.addAdEventListener(AdEventType.LOADED, () => {
        rewarded.show().catch(() => finish(false));
      });

      rewarded.load();
      setTimeout(() => finish(false, new Error('Ad load timed out')), 25_000);
    });
  },
};

export { AD_UNIT_REWARDED };