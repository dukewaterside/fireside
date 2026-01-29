import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase/client';

export default function RootLayout() {
  const segments = useSegments();

  useEffect(() => {
    let isMounted = true;

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
      const firstSegment = segments[0];

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
      const firstSegment = segments[0];

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
  }, [segments]);

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