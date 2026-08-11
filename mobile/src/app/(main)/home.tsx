import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/state/auth';
import { formatCents } from '@/utils/format';
import { errorMessage } from '@/api/client';

export default function HomeScreen() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const copyReferral = useCallback(async () => {
    if (!user) return;
    try {
      const { copyText } = await import('@/utils/format');
      await copyText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [user]);

  // pull-to-refresh via scroll refreshControl
  const onRefresh = useCallback(async () => {
    try {
      await refresh();
    } catch (err) {
      errorMessage(err);
    }
  }, [refresh]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.text} />
        }
        contentContainerStyle={styles.content}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={{ letterSpacing: 1 }}>
          HavEarn
        </ThemedText>

        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Available balance
          </ThemedText>
          <ThemedText type="title" style={styles.balance}>
            {formatCents(user?.balanceCents ?? 0)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Lifetime earned: {formatCents(user?.lifetimeEarnedCents ?? 0)}
          </ThemedText>
        </View>

        {/* Quick actions */}
        <View style={styles.grid}>
          <ActionCard
            label="Share internet"
            sub="Bandwidth"
            onPress={() => router.push('/(main)/share')}
            theme={theme.backgroundElement}
          />
          <ActionCard
            label="Watch ads"
            sub="Rewarded"
            onPress={() => router.push('/(main)/earn')}
            theme={theme.backgroundElement}
          />
          <ActionCard
            label="Tasks"
            sub="& Surveys"
            onPress={() => router.push('/(main)/tasks')}
            theme={theme.backgroundElement}
          />
          <ActionCard
            label="Withdraw"
            sub="Earnings"
            onPress={() => router.push('/(main)/profile')}
            theme={theme.backgroundElement}
          />
        </View>

        {/* Referral */}
        <View style={[styles.referral, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Invite friends</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Share your code — earn a bonus for each signup.
          </ThemedText>
          <Pressable onPress={copyReferral} style={styles.codeChip}>
            <ThemedText type="smallBold" style={{ color: '#3c87f7', letterSpacing: 2 }}>
              {user?.referralCode ?? '——'}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            {copied ? 'Copied!' : 'Tap to copy'}
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({
  label,
  sub,
  onPress,
  theme,
}: {
  label: string;
  sub: string;
  onPress: () => void;
  theme: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme },
        pressed && { opacity: 0.7 },
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {sub}
      </ThemedText>
    </Pressable>
  );
}

// Minimal refresh control without extra imports
function CustomRefreshControl(props: {
  refreshing: boolean;
  onRefresh: () => void;
  tintColor: string;
}) {
  // Use RN's RefreshControl when available; keep static here to avoid reanimated churn.
  const rc = require('react-native').RefreshControl;
  const React = require('react');
  return React.createElement(rc, props);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four },
  balanceCard: { borderRadius: 20, padding: Spacing.four, gap: Spacing.one },
  balance: { fontSize: 40, lineHeight: 46, fontWeight: 700 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  card: { flexGrow: 1, flexBasis: '45%', minWidth: 140, borderRadius: 16, padding: Spacing.three, gap: 2 },
  referral: { borderRadius: 16, padding: Spacing.four, gap: Spacing.two },
  codeChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(60,135,247,0.12)',
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
});