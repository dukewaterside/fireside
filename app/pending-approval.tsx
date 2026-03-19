import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { signOut } from '../lib/services/auth';
import { LogginButton } from '../components/LogginButton';

const FONT_LOAD_TIMEOUT_MS = 5000;

export default function PendingApprovalScreen() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const isDenied = status === 'denied';

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  if (!fontsLoaded && !fontTimeout) {
    return (
      <View style={{ flex: 1, backgroundColor: '#2e2e2e', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#f2681c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>
          {isDenied ? 'Account not approved' : 'Pending approval'}
        </Text>
        <Text style={styles.message}>
          {isDenied
            ? 'Your account was denied access. Please contact an owner if you believe this is an error.'
            : 'Your account is pending approval by an owner. You will be able to use the app once approved.'}
        </Text>
        <LogginButton
          label="Sign out"
          onPress={handleSignOut}
          backgroundColor="#f2681c"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#2e2e2e',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  title: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
});
