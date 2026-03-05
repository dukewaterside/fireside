import React, { useState, useEffect } from 'react';
import { Image, View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { LogginButton } from '../components/LogginButton';
import { signIn, resetPasswordForEmail } from '../lib/services/auth';
import { supabase } from '../lib/supabase/client';
import { hasCompletedOnboarding } from '../lib/onboarding';
import { registerAndSavePushToken } from '../lib/notifications/push';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [error, setError] = useState('');

  const SIGN_IN_RETRY_DELAY_MS = 1200;

  useEffect(() => {
    // _layout.tsx handles routing via onAuthStateChange (INITIAL_SESSION event).
    // Nothing to do here on mount.
  }, []);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const handleSignIn = async () => {
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    setIsLoading(true);

    // Safety net: reset loading after 20s if _layout.tsx never navigates away.
    const loadingTimeout = setTimeout(() => setIsLoading(false), 20_000);

    const stopLoading = () => {
      clearTimeout(loadingTimeout);
      setIsLoading(false);
    };

    try {
      const emailNormalized = email.trim().toLowerCase();
      let response = await signIn(emailNormalized, password);
      if (!response.success) {
        const message = (response.error ?? '').toLowerCase();
        const shouldRetry =
          message.includes('network') ||
          message.includes('fetch') ||
          message.includes('timeout') ||
          message.includes('timed out');
        if (shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, SIGN_IN_RETRY_DELAY_MS));
          response = await signIn(emailNormalized, password);
        }
      }
      if (!response.success) {
        setError(response.error || 'Failed to sign in');
        stopLoading();
        return;
      }
      if (!response?.user) {
        setError('Could not finish sign-in. Please try again.');
        stopLoading();
        return;
      }

      // Sign-in succeeded. _layout.tsx's onAuthStateChange(SIGNED_IN) will fire
      // and handle routing (to tabs, onboarding, or pending-approval). We stay
      // in the loading state while that navigation happens — the 20s timeout
      // above is the safety net if something unexpected prevents it.
      registerAndSavePushToken().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      stopLoading();
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    const emailToUse = email.trim().toLowerCase();
    if (!emailToUse) {
      setError('Enter your email above, then tap Forgot Password.');
      return;
    }
    setIsResettingPassword(true);
    try {
      const redirectTo = Linking.createURL('reset-password');
      const response = await resetPasswordForEmail(emailToUse, { redirectTo });
      if (response.success) {
        Alert.alert(
          'Check your email',
          'If an account exists for that email, we sent a code. Enter it on the next screen to set a new password.',
          [{ text: 'OK', onPress: () => router.push(`/reset-password?email=${encodeURIComponent(emailToUse)}`) }]
        );
      } else {
        setError(response.error || 'Something went wrong. Try again later.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <Image source={require('../assets/fireside.png')} style={styles.localImage} />
          <View style={{ height: 40 }} />
          <TextInput
            autoCapitalize="none"
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            placeholder="Email"
            placeholderTextColor="#999"
          />
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            style={[styles.input, !fontsLoaded && { fontFamily: undefined }]}
            onChangeText={setPassword}
            value={password}
            placeholder="Password"
            placeholderTextColor="#999"
          />
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={handleForgotPassword}
            disabled={isResettingPassword}
          >
            <Text style={styles.forgotPasswordText}>
              {isResettingPassword ? 'Sending…' : 'Forgot Password?'}
            </Text>
          </TouchableOpacity>
          <LogginButton
            label={isLoading ? 'Signing In...' : 'Sign In'}
            onPress={handleSignIn}
            backgroundColor={isLoading ? '#999' : '#f2681c'}
          />
          <LogginButton
            label="Create New Account"
            onPress={() => router.push('/create-account')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#3b3b3b' },
  localImage: {
    width: 280,
    height: 64,
    resizeMode: 'contain',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b3b3b',
    padding: 20,
  },
  inner: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    color: 'white',
    fontFamily: 'Inter_400Regular',
    backgroundColor: '#4a4a4a',
  },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -10 },
  forgotPasswordText: { color: '#f2681c', fontSize: 14, fontFamily: 'Inter_400Regular' },
  errorContainer: { width: '100%', backgroundColor: '#ff4444', padding: 12, borderRadius: 8, marginBottom: 20 },
  errorText: { color: 'white', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
