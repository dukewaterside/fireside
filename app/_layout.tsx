import { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase/client';
import { setNotificationResponseHandler } from '../lib/notifications/push';
import { hasCompletedOnboarding } from '../lib/onboarding';

export default function RootLayout() {
  const segments = useSegments();
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    const remove = setNotificationResponseHandler();
    return remove;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const getFirstSegment = () => (segmentsRef.current?.[0] ?? null);

    const handleSession = async (session: any) => {
      if (!isMounted || !session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isMounted) return;
      const status = profile?.status ?? 'active';
      const firstSegment = getFirstSegment();

      if (status === 'pending' && firstSegment !== 'pending-approval') {
        router.replace('/pending-approval');
      } else if (status === 'denied' && firstSegment !== 'pending-approval') {
        router.replace('/pending-approval?status=denied');
      } else if (status === 'active') {
        const completed = await hasCompletedOnboarding(session.user.id);
        if (!isMounted) return;
        // Only navigate to tabs from auth/entry screens; don't disrupt active screens.
        if (firstSegment === '/' || firstSegment === 'sign-in' || firstSegment === 'onboarding') {
          router.replace(completed ? '/(tabs)' : '/onboarding');
        }
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
      <StatusBar style="light" backgroundColor="#3b3b3b" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#3b3b3b' },
          navigationBarColor: '#3b3b3b',
        }}
      />
    </>
  );
}
