import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Field, LoadingModal, Screen } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/state/auth';
import { Spacing } from '@/constants/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn({ email, password });
      // AuthRedirect routes to terms if needed, else main app.
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">Welcome back</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.four }}>
          Sign in to your account.
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
          autoComplete="current-password"
        />

        {error ? (
          <ThemedText type="small" style={{ color: '#e5484d', marginBottom: Spacing.two }}>
            {error}
          </ThemedText>
        ) : null}

        <Button label="Sign in" onPress={submit} loading={loading} />

        <Pressable onPress={() => router.replace('/(onboarding)/welcome')} style={styles.back}>
          <ThemedText type="small" themeColor="textSecondary">
            Back to welcome
          </ThemedText>
        </Pressable>
      </ScrollView>
      <LoadingModal visible={loading} text="Signing in…" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, paddingTop: Spacing.five },
  back: { marginTop: Spacing.three, alignItems: 'center' },
});