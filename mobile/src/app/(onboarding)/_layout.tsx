import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="terms" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}