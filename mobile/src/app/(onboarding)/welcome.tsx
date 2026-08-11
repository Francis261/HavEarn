import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const go = (path: 'signin' | 'signup') => router.push(`/(onboarding)/${path}` as never);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="title" style={{ fontSize: 32, color: '#3c87f7' }}>
            H
          </ThemedText>
        </View>
        <ThemedText type="title" style={styles.heroTitle}>
          Welcome to HavEarn
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Earn by sharing your unused internet, watching rewarded ads, and completing tasks.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Button label="Create an account" onPress={() => go('signup')} />
        <Pressable onPress={() => go('signin')} style={styles.signinLink}>
          <ThemedText type="small">
            Already have an account?{' '}
            <ThemedText type="smallBold" style={{ color: '#3c87f7' }}>
              Sign in
            </ThemedText>
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: Spacing.four },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 34, lineHeight: 40 },
  subtitle: { maxWidth: 340, lineHeight: 20 },
  actions: { gap: Spacing.two },
  signinLink: { alignItems: 'center', paddingVertical: Spacing.two },
});