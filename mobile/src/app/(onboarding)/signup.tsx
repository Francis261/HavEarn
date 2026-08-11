import { router, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Field, LoadingModal, Screen } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/state/auth';
import { Spacing } from '@/constants/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = email.length > 3 && password.length >= 8;

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await signUp({
        email,
        password,
        referralCode: referral.trim() || undefined,
      });
      router.replace('/(onboarding)/terms');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">Create account</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.four }}>
          Start earning in minutes.
        </ThemedText>

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <Field
          label="Referral code (optional)"
          value={referral}
          onChangeText={setReferral}
          autoCapitalize="characters"
        />

        {error ? (
          <ThemedText type="small" style={{ color: '#e5484d', marginBottom: Spacing.two }}>
            {error}
          </ThemedText>
        ) : null}

        <Button label="Create account" onPress={submit} disabled={!canSubmit} loading={loading} />

        <Pressable onPress={() => router.back()} style={{ marginTop: Spacing.three, alignItems: 'center' }}>
          <ThemedText type="small" themeColor="textSecondary">
            Back to welcome
          </ThemedText>
        </Pressable>
      </ScrollView>
      <LoadingModal visible={loading} text="Creating account…" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, paddingTop: Spacing.five },
});