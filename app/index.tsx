import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase/client';

const SESSION_TIMEOUT_MS = 2500;  // Don't wait more than 2.5s for getSession
const PROFILE_TIMEOUT_MS = 2000;  // Don't wait more than 2s for profile
const FALLBACK_TIMEOUT_MS = 3000; // If anything hangs, show sign-in after 3s

function raceTimeout<T>(ms: number, p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

export default function Index() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fallback = setTimeout(() => {
      if (isMounted) {
        setChecking(false);
        router.replace('/sign-in');
      }
    }, FALLBACK_TIMEOUT_MS);

    (async () => {
      try {
        const { data: { session } } = await raceTimeout(
          SESSION_TIMEOUT_MS,
          supabase.auth.getSession()
        );
        if (!isMounted) return;
        setChecking(false);
        clearTimeout(fallback);
        if (!session) {
          router.replace('/sign-in');
          return;
        }
        const profileResult = await raceTimeout(
          PROFILE_TIMEOUT_MS,
          Promise.resolve(supabase.from('profiles').select('status').eq('id', session.user.id).single())
        );
        const profile = profileResult?.data;
        if (!isMounted) return;
        const status = profile?.status ?? 'active';
        if (status === 'pending') {
          router.replace('/pending-approval');
          return;
        }
        if (status === 'denied') {
          router.replace('/pending-approval?status=denied');
          return;
        }
        router.replace('/(tabs)');
      } catch {
        if (isMounted) {
          setChecking(false);
          clearTimeout(fallback);
          router.replace('/sign-in');
        }
      }
    })();
    return () => {
      isMounted = false;
      clearTimeout(fallback);
    };
  }, []);

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f2681c" />
        <Text style={styles.hint}>Checking sign-in…</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b3b3b',
  },
  hint: {
    color: '#999',
    marginTop: 12,
    fontSize: 14,
  },
});
