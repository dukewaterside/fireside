// Import React hooks for managing component state
import React, {useState} from 'react';
// Import React Native components
import { Image, View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
// Import SafeAreaView to handle device safe areas
import { SafeAreaView } from 'react-native-safe-area-context';
// Import router from Expo Router for navigation
import { router } from 'expo-router';
// Import expo-linking to build the URL the app uses when the user clicks the reset link in email
import * as Linking from 'expo-linking';
// Import fonts
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
// Import our custom button component
import {LogginButton} from '../components/LogginButton'
// Import our auth service (signIn + resetPasswordForEmail for forgot-password)
import { signIn, resetPasswordForEmail } from '../lib/services/auth';

export default function Index() {
  // State variables to store the email and password input values
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // State to track if we're currently signing in (for loading state)
  const [isLoading, setIsLoading] = useState(false)
  // State to track if we're sending the forgot-password email (so we don't double-tap)
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  // State to store any error messages
  const [error, setError] = useState('')
  
  // Load fonts
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  /**
   * Handles the sign in process when user taps "Sign In" button
   */
  const handleSignIn = async () => {
    // Clear any previous errors
    setError('');

    // Basic validation - check if fields are filled
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    // Set loading state to true (disables button and shows loading)
    setIsLoading(true);

    try {
      // Call our signIn function from the auth service
      // The 'await' keyword waits for this async operation to complete
      const response = await signIn(email.trim().toLowerCase(), password);

      // Check if sign in was successful
      if (response.success) {
        router.replace('/(tabs)');
      } else {
        // If sign in failed, show the error message
        setError(response.error || 'Failed to sign in');
      }
    } catch (err) {
      // Catch any unexpected errors
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      // Always set loading to false when done
      setIsLoading(false);
    }
  };

  /**
   * Handles "Forgot Password?" — sends a password-reset email via Supabase.
   * Uses the email from the form. The link in the email will open our app at
   * /reset-password (see app/reset-password.tsx). redirectTo must be allowed
   * in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
   */
  const handleForgotPassword = async () => {
    setError('');
    const emailToUse = email.trim().toLowerCase();
    if (!emailToUse) {
      setError('Enter your email above, then tap Forgot Password.');
      return;
    }
    setIsResettingPassword(true);
    try {
      // Where the user lands after clicking the link in the email. Must match
      // a route in our app (e.g. app/reset-password.tsx) and be in Supabase’s
      // Redirect URL allow list.
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
        <Image
        source={require('/Users/dukediamond/fireside/assets/fireside.png')}
        style={styles.localImage}
        />
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
          secureTextEntry={true}
          style={styles.input}
          onChangeText={setPassword}
          value={password}
          placeholder="Password"
          placeholderTextColor="#999"
        />

        {/* Error Message Display */}
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

        {/* Sign In Button - now connected to actual auth */}
        <LogginButton
          label={isLoading ? 'Signing In...' : 'Sign In'}
          onPress={handleSignIn}
          backgroundColor={isLoading ? '#999' : '#f2681c'}
        />
        
        {/* Create New Account Button - navigates to create account page */}
        <LogginButton
          label="Create New Account"
          onPress={() => router.push('/create-account')}
        />
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#3b3b3b',
  },
  localImage: {
    resizeMode: 'center',
  },
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -10,
  },
  forgotPasswordText: {
    color: '#f2681c',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  errorContainer: {
    width: '100%',
    backgroundColor: '#ff4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
