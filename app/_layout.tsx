import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase/client';
import { registerAndSavePushToken, setNotificationResponseHandler } from '../lib/notifications/push';
import { hasCompletedOnboarding } from '../lib/onboarding';

export default function RootLayout() {
  const segments = useSegments();
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    const remove = setNotificationResponseHandler();
    return remove;
  }, []);

  // Re-run push token registration whenever app comes to foreground (e.g. user reopens app).
  // This helps ensure token is saved even if the first attempt failed or permission was granted later.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) registerAndSavePushToken().catch(() => {});
      })();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const getFirstSegment = () => (segmentsRef.current?.[0] ?? null);

    const handleSession = async (session: any) => {
      if (!isMounted || !session) return;

      const completed = await hasCompletedOnboarding(session.user.id);
      if (!isMounted) return;
      const firstSegment = getFirstSegment();
      // Only navigate to tabs from auth/entry screens; don't disrupt active screens.
      if (firstSegment === '/' || firstSegment === 'sign-in' || firstSegment === 'onboarding') {
        router.replace(completed ? '/(tabs)' : '/onboarding');
      }
    };

    // INITIAL_SESSION fires immediately with the stored session on app launch.
    // SIGNED_IN fires when the user signs in.
    // We intentionally ignore TOKEN_REFRESHED and USER_UPDATED to avoid
    // spurious navigation attempts during normal app use.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        handleSession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // Run once; segmentsRef has latest segments so we don't re-run on every navigation

  return (
    <>
      <StatusBar style="light" backgroundColor="#2e2e2e" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#2e2e2e' },
          navigationBarColor: '#2e2e2e',
        }}
      />
    </>
  );
}
