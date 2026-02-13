import React, { useState, useEffect } from 'react';
import { Image, View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { LogginButton } from '../components/LogginButton';
import { signIn, resetPasswordForEmail } from '../lib/services/auth';
import { supabase } from '../lib/supabase/client';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [error, setError] = useState('');

  const PROFILE_STATUS_RETRY_COUNT = 6;
  const PROFILE_STATUS_RETRY_DELAY_MS = 500;
  const SIGN_IN_RETRY_DELAY_MS = 1200;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted || !session) return;
        const status = await fetchProfileStatusWithRetry(session.user.id);
        if (status === 'pending') router.replace('/pending-approval');
        else if (status === 'denied') router.replace('/pending-approval?status=denied');
        else router.replace('/(tabs)');
      } catch {
        // Ignore; stay on sign-in
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const fetchProfileStatusWithRetry = async (userId: string): Promise<'pending' | 'active' | 'denied'> => {
    for (let attempt = 0; attempt < PROFILE_STATUS_RETRY_COUNT; attempt++) {
      const { data } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', userId)
        .maybeSingle();
      const status = (data as { status?: 'pending' | 'active' | 'denied' } | null)?.status;
      if (status) return status;
      await new Promise((resolve) => setTimeout(resolve, PROFILE_STATUS_RETRY_DELAY_MS));
    }
    return 'active';
  };

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
      if (response && !response.success) {
        setError(response.error || 'Failed to sign in');
        return;
      }
      if (!response?.user) {
        setError('Could not finish sign-in. Please try again.');
        return;
      }

      const profileStatus = await fetchProfileStatusWithRetry(response.user.id);
      if (profileStatus === 'pending') {
        router.replace('/pending-approval');
        return;
      }
      if (profileStatus === 'denied') {
        const { signOut } = await import('../lib/services/auth');
        await signOut();
        setError('Your account was denied access. Please contact an owner.');
        return;
      }
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
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
      <View style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#3b3b3b' },
  localImage: { resizeMode: 'center' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b3b3b',
    padding: 20,
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
