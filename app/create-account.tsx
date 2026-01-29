// Import React hooks for managing component state
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
// Import SafeAreaView to handle notches and safe areas on different devices
import { SafeAreaView } from 'react-native-safe-area-context';
// Import router from Expo Router for navigation
import { router } from 'expo-router';
// Import fonts
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { LogginButton } from '../components/LogginButton';
// Import our custom picker component (better UX than native Picker)
import { CustomPicker } from '../components/CustomPicker';
import { CustomMultiPicker } from '../components/CustomMultiPicker';
// Import our auth service and types
import { signUp, UserRole, Trade, SignUpData } from '../lib/services/auth';
import { supabase } from '../lib/supabase/client';

export default function CreateAccount() {
  // State variables to store form input values
  // useState returns [currentValue, setterFunction]
  // We initialize each field with an empty string
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State for the role dropdown
  // We use 'Subcontractor' | 'Project Manager' | 'Owner' | 'Internal Developer' | '' as the type
  // The empty string represents "no selection yet"
  const [role, setRole] = useState<UserRole | ''>('');
  
  // State for the trade dropdown (only shown for subcontractors)
  const [trade, setTrade] = useState<Trade | ''>('');

  // State for assigned units (PM / Internal Developer)
  const [units, setUnits] = useState<{ id: string; unit_number: string }[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // State to track if we're currently submitting the form (for loading state)
  const [isLoading, setIsLoading] = useState(false);

  // State to store any error messages to display to the user
  const [error, setError] = useState('');

  const isPMOrID = role === 'Project Manager' || role === 'Internal Developer';

  const fetchUnits = useCallback(async () => {
    setUnitsLoading(true);
    setUnits([]);
    const { data, error: e } = await supabase
      .from('units')
      .select('id, unit_number')
      .order('unit_number', { ascending: true });
    setUnitsLoading(false);
    if (e) {
      console.warn('[CreateAccount] Failed to load units:', e.message);
      return;
    }
    setUnits((data as { id: string; unit_number: string }[]) ?? []);
  }, []);

  useEffect(() => {
    if (isPMOrID) fetchUnits();
    else setSelectedUnitIds([]);
  }, [isPMOrID, fetchUnits]);

  // Load fonts (same pattern as login page)
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  // Don't render anything until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  /**
   * Validates the form before submission
   * Returns true if all fields are valid, false otherwise
   */
  const validateForm = (): boolean => {
    // Clear any previous errors
    setError('');

    // Check if first name is provided
    if (!firstName.trim()) {
      setError('First name is required');
      return false;
    }

    // Check if last name is provided
    if (!lastName.trim()) {
      setError('Last name is required');
      return false;
    }

    // Check if phone is provided
    if (!phone.trim()) {
      setError('Phone number is required');
      return false;
    }

    // Basic email validation using a regular expression
    // This checks if the email has a valid format (something@something.something)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setError('Email is required');
      return false;
    } else if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Check if password is provided and meets minimum length
    if (!password) {
      setError('Password is required');
      return false;
    } else if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    // Check if role is selected
    if (!role) {
      setError('Please select a role');
      return false;
    }

    // If role is Subcontractor, trade is required
    if (role === 'Subcontractor' && !trade) {
      setError('Please select a trade');
      return false;
    }

    // If role is Project Manager or Internal Developer, at least one unit is required
    if (isPMOrID && selectedUnitIds.length === 0) {
      setError('Please select at least one assigned unit');
      return false;
    }

    // All validations passed!
    return true;
  };

  /**
   * Handles the form submission when user taps "Create Account"
   */
  const handleSignUp = async () => {
    // First, validate the form
    if (!validateForm()) {
      // If validation fails, the error state is already set, so we just return
      return;
    }

    // Set loading state to true (this disables the button and shows loading indicator)
    setIsLoading(true);
    setError(''); // Clear any previous errors

    try {
      const signUpData: SignUpData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        role: role as UserRole,
        trade: role === 'Subcontractor' ? (trade as Trade) : undefined,
        assignedUnitIds: isPMOrID && selectedUnitIds.length > 0 ? selectedUnitIds : undefined,
      };

      const response = await signUp(signUpData);

      if (response.success && response.user?.id) {
        const userId = response.user.id;

        if (isPMOrID && selectedUnitIds.length > 0) {
          const assignmentType =
            role === 'Project Manager' ? 'project_manager' : 'internal_developer';
          const rows = selectedUnitIds.map((unit_id) => ({
            user_id: userId,
            unit_id,
            assignment_type: assignmentType,
          }));

          const { data: { session } } = await supabase.auth.getSession();
          if (!session || session.user?.id !== userId) {
            await new Promise((r) => setTimeout(r, 600));
          }

          const { error: insertError } = await supabase
            .from('unit_assignments')
            .insert(rows);

          if (insertError) {
            console.error('[CreateAccount] unit_assignments insert failed:', insertError);
            Alert.alert(
              'Account created',
              'Your account was created, but we could not save your unit assignments. Please sign in and contact an owner to assign your units.',
              [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
            );
          } else {
            Alert.alert(
              'Account Created!',
              'Your account has been created successfully. You can now sign in.',
              [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
            );
          }
        } else {
          Alert.alert(
            'Account Created!',
            'Your account has been created successfully. You can now sign in.',
            [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
          );
        }
      } else if (response.success) {
        Alert.alert(
          'Account Created!',
          'Your account has been created successfully. You can now sign in.',
          [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
        );
      } else {
        setError(response.error || 'Failed to create account');
      }
    } catch (err) {
      // Catch any unexpected errors
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      // Always set loading to false when done (whether success or failure)
      // The 'finally' block always runs, even if there's an error
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* ScrollView allows the form to scroll if content is too tall for the screen */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled" // Allows tapping buttons even when keyboard is open
      >
        <View style={styles.container}>
          {/* Page Title */}
          <Text style={styles.title}>Create Account</Text>

          {/* Error Message Display */}
          {/* Only show this View if there's an error message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* First Name Input */}
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#999"
            value={firstName}
            onChangeText={setFirstName} // Updates firstName state when user types
            autoCapitalize="words"        // Capitalizes first letter of each word
          />

          {/* Last Name Input */}
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#999"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          {/* Phone Input */}
          <TextInput
            style={styles.input}
            placeholder="Phone"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"      // Shows numeric keypad on mobile
            autoCapitalize="none"
          />

          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"  // Shows email-optimized keyboard
            autoCapitalize="none"
            autoCorrect={false}          // Disables autocorrect for emails
          />

          {/* Password Input */}
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}        // Hides the password as user types
            autoCapitalize="none"
          />

          {/* Confirm Password Input */}
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={true}
            autoCapitalize="none"
          />

          {/* Role Dropdown */}
          {/* CustomPicker provides a better UX with a modal list instead of wheel picker */}
          <CustomPicker<UserRole>
            selectedValue={role}
            onValueChange={(itemValue) => {
              setRole(itemValue);
              if (itemValue !== 'Subcontractor') setTrade('');
              if (itemValue !== 'Project Manager' && itemValue !== 'Internal Developer') {
                setSelectedUnitIds([]);
              }
            }}
            placeholder="Select Role"
            items={[
              { label: 'Subcontractor', value: 'Subcontractor' },
              { label: 'Project Manager', value: 'Project Manager' },
              { label: 'Owner', value: 'Owner' },
              { label: 'Internal Developer', value: 'Internal Developer' },
            ]}
            hasError={error.includes('role')} // Show error styling if role validation failed
          />

          {/* Trade Dropdown - Only shown when Subcontractor is selected */}
          {/* Conditional rendering: only render this View if role === 'Subcontractor' */}
          {role === 'Subcontractor' && (
            <CustomPicker<Trade>
              selectedValue={trade}
              onValueChange={setTrade}
              placeholder="Select Trade"
              items={[
                { label: 'Framing', value: 'Framing' },
                { label: 'Electrical', value: 'Electrical' },
                { label: 'Plumbing', value: 'Plumbing' },
                { label: 'HVAC', value: 'HVAC' },
                { label: 'Countertops', value: 'Countertops' },
                { label: 'Flooring', value: 'Flooring' },
              ]}
              hasError={error.includes('trade')}
            />
          )}

          {/* Assigned units dropdown - only for Project Manager / Internal Developer */}
          {(role === 'Project Manager' || role === 'Internal Developer') && (
            <>
              {unitsLoading ? (
                <View style={styles.unitLoading}>
                  <ActivityIndicator size="small" color="#f2681c" />
                  <Text style={styles.unitLoadingText}>Loading units…</Text>
                </View>
              ) : (
                <CustomMultiPicker
                  selectedValues={selectedUnitIds}
                  onValueChange={setSelectedUnitIds}
                  items={units.map((u) => ({ label: u.unit_number, value: u.id }))}
                  placeholder="Select units (by unit number)"
                  hasError={error.includes('assigned unit')}
                />
              )}
              {error.includes('assigned unit') && (
                <Text style={styles.unitError}>Please select at least one assigned unit</Text>
              )}
            </>
          )}

          {/* Create Account Button */}
          <LogginButton
            label={isLoading ? 'Creating Account...' : 'Create Account'}
            onPress={handleSignUp}
            backgroundColor={isLoading ? '#999' : '#f2681c'} // Gray out button when loading
          />

          {/* Back to Sign In Link */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()} // Navigate back to previous screen (login page)
          >
            <Text style={styles.backLinkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#3b3b3b',
  },
  scrollContent: {
    flexGrow: 1, // Allows content to grow and be scrollable
    paddingBottom: 20, // Padding at bottom for better scrolling
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b3b3b',
    padding: 20,
  },
  title: {
    fontSize: 28,
    color: 'white',
    fontFamily: 'Inter_400Regular',
    marginBottom: 30,
    textAlign: 'center',
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
  backLink: {
    marginTop: 20,
  },
  backLinkText: {
    color: '#f2681c',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  unitLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  unitLoadingText: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'Inter_400Regular',
  },
  unitError: {
    fontSize: 12,
    color: '#f2681c',
    marginTop: 6,
  },
});
