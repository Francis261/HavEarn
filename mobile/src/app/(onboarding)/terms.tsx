import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button, LoadingModal, Screen } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/api/client';
import { authApi } from '@/api/auth';
import { API_BASE_URL } from '@/constants/config';
import { useAuth } from '@/state/auth';
import { Spacing } from '@/constants/theme';
import type { Terms } from '@/types';

function TermsBody({ content }: { content: string }) {
  const theme = useTheme();
  const lines = content.split('\n');

  return (
    <View style={styles.body}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={i} style={{ height: 10 }} />;
        if (trimmed.startsWith('## ')) {
          return (
            <ThemedText key={i} type="smallBold" style={styles.sectionHeader}>
              {trimmed.slice(3)}
            </ThemedText>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <ThemedText key={i} style={[styles.title, { color: theme.text }]}>
              {trimmed.slice(2)}
            </ThemedText>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <ThemedText key={i} type="small" style={styles.bullet}>
              {'\u2022 '}
              {trimmed.slice(2)}
            </ThemedText>
          );
        }
        return (
          <ThemedText key={i} type="small" style={styles.paragraph}>
            {trimmed}
          </ThemedText>
        );
      })}
    </View>
  );
}

export default function TermsScreen() {
  const { acceptTerms, signOut } = useAuth();
  const [terms, setTerms] = useState<Terms | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [acceptedScroll, setAcceptedScroll] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authApi.currentTerms();
        setTerms(res.data.terms);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (layoutMeasurement.height + contentOffset.y);
    if (distanceFromBottom < 24) setAcceptedScroll(true);
  };

  const canAgree = useMemo(
    () => !!terms && acceptedScroll && consentChecked && !submitting,
    [terms, acceptedScroll, consentChecked, submitting],
  );

  const agree = async () => {
    if (!terms) return;
    setSubmitting(true);
    setError('');
    try {
      await acceptTerms(terms.version);
      router.replace('/(main)/home');
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingModal visible text="Loading terms…" />;

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        style={{ paddingHorizontal: Spacing.four }}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 32 }}>
            {terms?.title ?? 'Terms & Conditions'}
          </ThemedText>
          {terms ? (
            <ThemedText type="small" themeColor="textSecondary">
              Version {terms.version}
            </ThemedText>
          ) : null}
        </View>

        {error && !terms ? (
          <ThemedText type="small" style={{ color: '#e5484d' }}>
            {error}
          </ThemedText>
        ) : null}

        {terms ? <TermsBody content={terms.content} /> : null}
        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => setConsentChecked((v) => !v)}
          style={styles.consentRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentChecked }}>
          <View style={[styles.checkbox, consentChecked && styles.checkboxOn]}>
            {consentChecked ? <ThemedText type="smallBold" style={{ color: '#fff' }}>✓</ThemedText> : null}
          </View>
          <ThemedText type="small" style={styles.consentText}>
            I give my explicit consent to share my device’s unused internet connection as part of
            the HavEarn network, and I accept the terms above.
          </ThemedText>
        </Pressable>

        {!acceptedScroll && terms ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Please scroll to the bottom to continue.
          </ThemedText>
        ) : null}

        <Button label="I Agree" onPress={agree} disabled={!canAgree} loading={submitting} />
        <Pressable onPress={() => openLegal(API_BASE_URL + '/legal/privacy')} style={styles.signOut}>
          <ThemedText type="small" themeColor="textSecondary">
            Read our Privacy Policy
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => signOut().then(() => router.replace('/(onboarding)/welcome'))} style={styles.signOut}>
          <ThemedText type="small" themeColor="textSecondary">
            Sign out
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

async function openLegal(url: string) {
  try {
    const { default: WebBrowser } = await import('expo-web-browser');
    await WebBrowser.openBrowserAsync(url);
  } catch {
    /* link unavailable */
  }
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: Spacing.five, paddingBottom: Spacing.three },
  header: { marginBottom: Spacing.four },
  body: { gap: 4 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: 700, marginBottom: 8 },
  sectionHeader: { fontSize: 16, lineHeight: 22, marginTop: 16, marginBottom: 4 },
  paragraph: { lineHeight: 20, marginBottom: 6 },
  bullet: { lineHeight: 20, marginBottom: 4, paddingLeft: 4 },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3c87f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: '#3c87f7', borderColor: '#3c87f7' },
  consentText: { flex: 1, lineHeight: 20 },
  signOut: { alignItems: 'center' },
});