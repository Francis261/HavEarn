import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LoadingModal } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { earnApi } from '@/api/earn';
import { errorMessage } from '@/api/client';
import { adMobAdapter } from '@/ads/rewarded';
import { useAuth } from '@/state/auth';
import { formatCents } from '@/utils/format';

export default function EarnScreen() {
  const theme = useTheme();
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function watchAd() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const start = await earnApi.adStart({ deviceId: user?.id, adUnitId: 'rewarded' });
      setLoading(false);

      let earned = false;
      try {
        earned = await adMobAdapter.show();
      } catch {
        setError('Ad network unavailable in this build. Use a development build to watch ads.');
        return;
      }

      if (!earned) {
        setError('Ad was not completed. Try again.');
        return;
      }

      const res = await earnApi.adComplete(start.data.nonce);
      setMessage(`You earned ${formatCents(res.data.rewardCents)}!`);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 34 }}>
          Watch ads, earn cash
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Rewarded ads are credited only after you watch them to the end.
        </ThemedText>

        <View style={[styles.hero, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={{ fontSize: 44, fontWeight: 700, color: '#3c87f7' }}>
            {formatCents(earnReward(user))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            per rewarded ad
          </ThemedText>
          <Button label="Watch a rewarded ad" onPress={watchAd} loading={loading} />
          {message ? (
            <ThemedText type="smallBold" style={{ color: '#30a46c', textAlign: 'center' }}>
              {message}
            </ThemedText>
          ) : null}
          {error ? (
            <ThemedText type="small" style={{ color: '#e5484d', textAlign: 'center' }}>
              {error}
            </ThemedText>
          ) : null}
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.finePrint}>
          Daily limits and availability vary by region. Ads are served by Google AdMob.
        </ThemedText>
      </ScrollView>
      <LoadingModal visible={loading} text="Preparing ad…" />
    </SafeAreaView>
  );
}

function earnReward(_user?: { balanceCents?: number } | null): number {
  return 5; // matches server AD_REWARD_CENTS default
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four },
  hero: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  finePrint: { lineHeight: 18, opacity: 0.7 },
});