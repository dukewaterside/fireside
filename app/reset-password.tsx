// Screen for resetting password. Primary flow: code-only. User arrives with ?email=… from Forgot Password,
// enters the code from the recovery email and new password; we verifyOtp + updateUser.
// Supabase Recovery template should include only {{ .Token }} (no link). Code length is whatever Supabase sends (e.g. 6–8 digits).

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { LogginButton } from '../components/LogginButton';
import { supabase } from '../lib/supabase/client';

/**
 * Parses Supabase recovery tokens from a URL.
 * Tries hash first (#access_token=...&refresh_token=...&type=recovery), then query (?...),
 * because on some mobile flows the fragment is stripped when opening the app.
 */
function parseRecoveryTokensFromUrl(url: string | null): {
  access_token: string;
  refresh_token: string;
} | null {
  if (!url) return null;
  const parts = url.split('#');
  const hash = parts[1] || '';
  const beforeHash = parts[0] || '';
  const queryStart = beforeHash.indexOf('?');
  const query = queryStart >= 0 ? beforeHash.slice(queryStart + 1) : '';
  const paramString = hash || query;
  if (!paramString) return null;
  const params = new URLSearchParams(paramString);
  const type = params.get('type');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (type !== 'recovery' || !access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

function normalizeParam(p: string | string[] | undefined): string {
  if (p == null) return '';
  return Array.isArray(p) ? (p[0] ?? '') : p;
}

export default function ResetPasswordScreen() {
  const raw = useLocalSearchParams<{ email?: string | string[] }>();
  const emailParam = normalizeParam(raw.email);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingUrl, setCheckingUrl] = useState(true);
  const [otpMode, setOtpMode] = useState(false); // true = show "enter code" form (no tokens in URL)
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const tryRestoreSessionFromUrl = useCallback(async (url: string | null) => {
    const tokens = parseRecoveryTokensFromUrl(url);
    if (!tokens) return false;
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (sessionError) {
      setError(sessionError.message || 'Invalid or expired link.');
      setCheckingUrl(false);
      return false;
    }
    setSessionReady(true);
    setError('');
    return true;
  }, []);

  useEffect(() => {
    let subscription: { remove: () => void } | undefined;

    const run = async () => {
      // App opened from link (cold start): getInitialURL has the URL
      const initialUrl = await Linking.getInitialURL();
      if (await tryRestoreSessionFromUrl(initialUrl)) {
        setCheckingUrl(false);
        return;
      }
      // App was in background and user opened link: listen for URL
      subscription = Linking.addEventListener('url', async ({ url }) => {
        await tryRestoreSessionFromUrl(url);
      });
      setCheckingUrl(false);
      // If we have email from params (navigated from Forgot Password), show OTP form
      if (emailParam) {
        setOtpMode(true);
        setEmail(emailParam);
      }
    };

    run();
    return () => subscription?.remove();
  }, [tryRestoreSessionFromUrl, emailParam]);

  const handleSubmitNewPassword = async () => {
    setError('');
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message || 'Could not update password.');
        return;
      }
      Alert.alert(
        'Password updated',
        'You can now sign in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  /** OTP flow: verify code from email, then set new password. Supabase may send 6–8 digits; we accept any length 4–12. */
  const handleSubmitOtpAndPassword = async () => {
    setError('');
    const emailToUse = email.trim().toLowerCase();
    if (!emailToUse) {
      setError('Enter your email.');
      return;
    }
    const codeClean = code.replace(/\s/g, '');
    if (!codeClean || codeClean.length < 4) {
      setError('Enter the code from your email.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: emailToUse,
        token: codeClean,
        type: 'recovery',
      });
      if (verifyError) {
        const msg = verifyError.message || 'Invalid or expired code.';
        const hint =
          msg.toLowerCase().includes('token') || msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')
            ? ' Try: request a new code (tap Forgot Password again), use it immediately, and ensure the Recovery template has no link—only the code {{ .Token }}.'
            : '';
        setError(msg + hint);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message || 'Could not update password.');
        return;
      }
      Alert.alert(
        'Password updated',
        'You can now sign in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {checkingUrl ? (
          <>
            <ActivityIndicator size="large" color="#f2681c" />
            <Text style={styles.hint}>Opening link…</Text>
          </>
        ) : !sessionReady && otpMode ? (
          <>
            <Text style={styles.title}>Enter code from email</Text>
            <Text style={styles.hint}>
              We sent a code to your email. Enter it below and choose a new password.
            </Text>
            <View style={{ height: 30 }} />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!emailParam}
            />
            <TextInput
              style={styles.input}
              placeholder="Code from email"
              placeholderTextColor="#999"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={12}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <LogginButton
              label={loading ? 'Updating…' : 'Set new password'}
              onPress={handleSubmitOtpAndPassword}
              backgroundColor={loading ? '#999' : '#f2681c'}
            />
          </>
        ) : !sessionReady ? (
          <>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.hint}>
              Go back to the login screen, tap Forgot Password, then enter the code we send you on the next screen.
            </Text>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <LogginButton
              label="Back to login"
              onPress={() => router.replace('/sign-in')}
              backgroundColor="#4a4a4a"
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>Set new password</Text>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <LogginButton
              label={loading ? 'Updating…' : 'Update password'}
              onPress={handleSubmitNewPassword}
              backgroundColor={loading ? '#999' : '#f2681c'}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#3b3b3b',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#3b3b3b',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 16,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    backgroundColor: '#4a4a4a',
  },
  errorContainer: {
    width: '100%',
    backgroundColor: '#ff4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
