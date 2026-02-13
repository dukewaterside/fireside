import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase/client';

const FALLBACK_TIMEOUT_MS = 8000; // Prevent getting stuck on splash if network stalls.

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
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setChecking(false);
        clearTimeout(fallback);
        if (!session) {
          router.replace('/sign-in');
          return;
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', session.user.id)
          .maybeSingle();
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
