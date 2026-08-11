import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { useAuth, useNeedsTerms } from '@/state/auth';

SplashScreen.preventAutoHideAsync();

function AuthRedirect() {
  const router = useRouter();
  const segments = useSegments();
  const { token, initialized } = useAuth();
  const needsTerms = useNeedsTerms();

  useEffect(() => {
    if (!initialized) return;

    const inOnboarding = segments[0] === '(onboarding)';
    const inTerms = segments.includes('terms');

    if (!token) {
      if (!inOnboarding) {
        router.replace('/(onboarding)/welcome');
      }
      return;
    }

    if (needsTerms && !inTerms) {
      router.replace('/(onboarding)/terms');
      return;
    }

    if (!needsTerms && inOnboarding) {
      router.replace('/(main)/home');
    }
  }, [segments, token, needsTerms, initialized, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { initialized, restore } = useAuth();

  useEffect(() => {
    restore().finally(() => SplashScreen.hideAsync());
  }, [restore]);

  if (!initialized) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthRedirect />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(main)" />
      </Stack>
    </ThemeProvider>
  );
}