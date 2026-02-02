import { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase/client';
import { setNotificationResponseHandler } from '../lib/notifications/push';

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

    // Only redirect when user IS signed in (to tabs or pending-approval).
    // When signed out we do NOT redirect — screens show sign-in prompts and block actions.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (!session) return; // Signed out: stay where you are, UI will show sign-in

      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', session.user.id)
        .single();

      if (!isMounted) return;
      const status = profile?.status ?? 'active';
      const firstSegment = getFirstSegment();

      if (status === 'pending' && firstSegment !== 'pending-approval') {
        router.replace('/pending-approval');
      } else if (status === 'denied' && firstSegment !== 'pending-approval') {
        router.replace('/pending-approval?status=denied');
      } else if (status === 'active') {
        // Only send to tabs when on an auth entry screen; don’t kick them off tickets, etc.
        if (firstSegment === '/' || firstSegment === 'sign-in') {
          router.replace('/(tabs)');
        }
      }
    });

    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (!session) return; // No session: don't redirect

      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', session.user.id)
        .single();

      if (!isMounted) return;
      const status = profile?.status ?? 'active';
      const firstSegment = getFirstSegment();

      if (status === 'pending' && firstSegment !== 'pending-approval') {
        router.replace('/pending-approval');
      } else if (status === 'denied' && firstSegment !== 'pending-approval') {
        router.replace('/pending-approval?status=denied');
      } else if (status === 'active' && (firstSegment === '/' || firstSegment === 'sign-in')) {
        router.replace('/(tabs)');
      }
    };

    checkInitialSession();

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