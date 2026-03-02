import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase/client';
import { navigateToSignIn } from '../../lib/navigation';
import { TRADE_LABELS } from '../../lib/constants/tickets';
import { CustomPicker } from '../../components/CustomPicker';
import { formatPhoneNumberInput, normalizePhoneDigits } from '../../lib/utils/phone';

const ROLE_OPTIONS = [
  { label: 'Owner', value: 'owner' },
  { label: 'Project Manager', value: 'project_manager' },
  { label: 'Designer', value: 'designer' },
  { label: 'Developer', value: 'developer' },
  { label: 'Subcontractor', value: 'subcontractor' },
] as const;

const TRADE_OPTIONS = Object.entries(TRADE_LABELS).map(([value, label]) => ({ label, value }));

type RoleValue = (typeof ROLE_OPTIONS)[number]['value'];

export default function AddContactScreen() {
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleValue | ''>('');
  const [trade, setTrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) return null;

  const validate = (): boolean => {
    setError('');

    if (!firstName.trim()) {
      setError('First name is required.');
      return false;
    }
    if (!lastName.trim()) {
      setError('Last name is required.');
      return false;
    }
    if (!phone.trim()) {
      setError('Phone is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      setError('Please enter a valid email.');
      return false;
    }
    if (!role) {
      setError('Role is required.');
      return false;
    }
    if (role === 'subcontractor' && !trade) {
      setError('Trade is required for subcontractors.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        Alert.alert('Sign in required', 'Please sign in before adding contacts.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign in', onPress: navigateToSignIn },
        ]);
        return;
      }

      const normalizedPhone = normalizePhoneDigits(phone);
      const normalizedEmail = email.trim() ? email.trim().toLowerCase() : null;

      const { error: insertError } = await supabase.from('contacts').insert({
        company_name: companyName.trim() || null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        phone_normalized: normalizedPhone || null,
        email: normalizedEmail,
        email_normalized: normalizedEmail,
        role,
        trade: role === 'subcontractor' ? trade : null,
        status: 'active',
      });

      if (insertError) {
        const msg = insertError.message?.toLowerCase() ?? '';
        if (msg.includes('contacts_email_normalized_unique')) {
          setError('A contact with this email already exists.');
        } else if (msg.includes('contacts_phone_normalized_unique')) {
          setError('A contact with this phone already exists.');
        } else if (msg.includes('duplicate')) {
          setError('A matching contact already exists.');
        } else {
          setError(insertError.message || 'Could not add contact.');
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      Alert.alert('Contact added', 'The new contact was added successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Contact</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Company (optional)"
          placeholderTextColor="#999"
          value={companyName}
          onChangeText={setCompanyName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="First Name"
          placeholderTextColor="#999"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          placeholderTextColor="#999"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor="#999"
          value={phone}
          onChangeText={(value) => setPhone(formatPhoneNumberInput(value))}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Email (optional)"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />

        <CustomPicker<RoleValue>
          selectedValue={role}
          onValueChange={(value) => {
            setRole(value);
            if (value !== 'subcontractor') setTrade('');
          }}
          placeholder="Select Role"
          items={ROLE_OPTIONS.map((opt) => ({ label: opt.label, value: opt.value }))}
          hasError={error.toLowerCase().includes('role')}
        />

        {role === 'subcontractor' && (
          <CustomPicker<string>
            selectedValue={trade}
            onValueChange={(value) => setTrade(value)}
            placeholder="Select Trade"
            items={TRADE_OPTIONS}
            hasError={error.toLowerCase().includes('trade')}
          />
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Add Contact</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3b3b3b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  headerSpacer: {
    width: 28,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  errorBanner: {
    backgroundColor: '#4a3333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#f2681c',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#f2681c',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
