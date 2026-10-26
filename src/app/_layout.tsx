import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { HouseholdProvider, useHousehold } from '@/lib/household';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <HouseholdProvider>
        <StatusBar style="dark" />
        <RootStack />
      </HouseholdProvider>
    </SessionProvider>
  );
}

// Three states: signed out, signed in without a household yet, and set up.
function RootStack() {
  const { session, loading: sessionLoading } = useSession();
  const { household, loading: householdLoading } = useHousehold();
  const ready = !sessionLoading && !(session && householdLoading);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !household}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!household}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
