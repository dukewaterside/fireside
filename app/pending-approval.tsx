import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { signOut } from '../lib/services/auth';
import { LogginButton } from '../components/LogginButton';

export default function PendingApprovalScreen() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const isDenied = status === 'denied';

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  if (!fontsLoaded) return null;

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
    backgroundColor: '#3b3b3b',
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
