import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { signOut } from '../../lib/services/auth';
import { ROLE_TYPE_OPTIONS } from '../../lib/constants/tickets';
import {
  formatPhoneNumberDisplay,
  formatPhoneNumberInput,
} from '../../lib/utils/phone';

type ProfileData = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string | null;
  trade: string | null;
  status: string | null;
};

type PendingUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  trade: string | null;
};

const TRADE_LABELS: Record<string, string> = {
  framing: 'Framing',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  countertops: 'Countertops',
  flooring: 'Flooring',
  painting: 'Painting',
  windows_doors: 'Windows & Doors',
  roofing: 'Roofing',
  insulation: 'Insulation',
  drywall: 'Drywall',
  other: 'Other',
};

function roleLabel(role: string | null): string {
  if (!role) return '—';
  const opt = ROLE_TYPE_OPTIONS.find((o) => o.value === role);
  return opt?.label ?? role;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [denyingId, setDenyingId] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const fetchProfile = useCallback(async () => {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setProfile(null);
      setSignedOut(true);
      return;
    }
    setSignedOut(false);
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role, trade, status')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchErr) {
      setError(fetchErr.message || 'Could not load profile.');
      setProfile(null);
      return;
    }
    const p = (data as ProfileData) ?? null;
    setProfile(p);
    if (p) {
      setEditFirstName(p.first_name ?? '');
      setEditLastName(p.last_name ?? '');
      setEditPhone(formatPhoneNumberDisplay(p.phone));
    }
  }, []);

  const fetchPendingUsers = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setPendingUsers([]);
      return;
    }
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, trade')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setPendingUsers([]);
      return;
    }
    setPendingUsers((data as PendingUser[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        if (!hasLoadedRef.current) setLoading(true);
        await fetchProfile();
        hasLoadedRef.current = true;
        if (mounted) setLoading(false);
      })();
      return () => { mounted = false; };
    }, [fetchProfile])
  );

  useFocusEffect(
    useCallback(() => {
      if (profile?.role === 'owner') {
        fetchPendingUsers();
      } else {
        setPendingUsers([]);
      }
    }, [profile?.role, fetchPendingUsers])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    if (profile?.role === 'owner') await fetchPendingUsers();
    setRefreshing(false);
  }, [fetchProfile, profile?.role, fetchPendingUsers]);

  const handleApproveUser = useCallback(
    async (userId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setApprovingId(userId);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          status: 'active',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', userId);

      setApprovingId(null);
      if (updateError) {
        Alert.alert('Error', updateError.message || 'Could not approve user.');
        return;
      }
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      await fetchProfile();
    },
    [fetchProfile]
  );

  const handleDenyUser = useCallback(
    async (userId: string) => {
      Alert.alert(
        'Deny user',
        'Are you sure you want to deny this user? They will not be able to sign in.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deny',
            style: 'destructive',
            onPress: async () => {
              setDenyingId(userId);
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ status: 'denied' })
                .eq('id', userId);

              setDenyingId(null);
              if (updateError) {
                Alert.alert('Error', updateError.message || 'Could not deny user.');
                return;
              }
              setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
            },
          },
        ]
      );
    },
    []
  );

  const handleSaveProfile = useCallback(async () => {
    if (!profile) return;
    setSaveError(null);
    setSaving(true);
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        first_name: editFirstName.trim() || null,
        last_name: editLastName.trim() || null,
        phone: formatPhoneNumberInput(editPhone).trim() || null,
      })
      .eq('id', profile.id);

    setSaving(false);
    if (updateErr) {
      setSaveError(updateErr.message || 'Could not save profile.');
      return;
    }
    setEditing(false);
    await fetchProfile();
  }, [profile, editFirstName, editLastName, editPhone, fetchProfile]);

  const handleSignOut = useCallback(async () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            const result = await signOut();
            if (result.success) {
              setProfile(null);
              setSignedOut(true);
              // No redirect: user stays on Profile tab and sees "Not signed in" with Sign in button
            } else {
              Alert.alert('Error', result.error || 'Could not sign out.');
            }
          },
        },
      ]
    );
  }, []);

  if (!fontsLoaded) return null;

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f2681c" />
        </View>
      </SafeAreaView>
    );
  }

  if (signedOut || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="person-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptySubtitle}>Sign in to view and edit your profile.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={navigateToSignIn}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Profile';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2681c" />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => fetchProfile()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile.first_name?.[0] ?? profile.last_name?.[0] ?? profile.email?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.email}>{profile.email ?? '—'}</Text>
          </View>

          {!editing ? (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>First name</Text>
                <Text style={styles.value}>{profile.first_name || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Last name</Text>
                <Text style={styles.value}>{profile.last_name || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{formatPhoneNumberDisplay(profile.phone) || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Role</Text>
                <Text style={styles.value}>{roleLabel(profile.role)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Status</Text>
                <Text style={[styles.value, profile.status === 'active' && styles.statusActive]}>
                  {profile.status ?? '—'}
                </Text>
              </View>
              {profile.role === 'subcontractor' && profile.trade ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Trade</Text>
                  <Text style={styles.value}>{TRADE_LABELS[profile.trade] ?? profile.trade}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
                <Ionicons name="pencil" size={18} color="#f2681c" />
                <Text style={styles.editButtonText}>Edit profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Edit profile</Text>
              <Text style={styles.inputLabel}>First name</Text>
              <TextInput
                style={styles.input}
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholder="First name"
                placeholderTextColor="#888"
                autoCapitalize="words"
              />
              <Text style={styles.inputLabel}>Last name</Text>
              <TextInput
                style={styles.input}
                value={editLastName}
                onChangeText={setEditLastName}
                placeholder="Last name"
                placeholderTextColor="#888"
                autoCapitalize="words"
              />
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={editPhone}
                onChangeText={(value) => setEditPhone(formatPhoneNumberInput(value))}
                placeholder="Phone"
                placeholderTextColor="#888"
                keyboardType="phone-pad"
              />
              {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setEditing(false);
                    setSaveError(null);
                    setEditFirstName(profile.first_name ?? '');
                    setEditLastName(profile.last_name ?? '');
                    setEditPhone(formatPhoneNumberDisplay(profile.phone));
                  }}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {profile.role === 'owner' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pending approvals</Text>
              {pendingUsers.length === 0 ? (
                <Text style={styles.pendingEmptyText}>No users waiting for approval.</Text>
              ) : (
                pendingUsers.map((u) => {
                  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '—';
                  const roleLabelVal = roleLabel(u.role);
                  const isApproving = approvingId === u.id;
                  const isDenying = denyingId === u.id;
                  const busy = isApproving || isDenying;
                  return (
                    <View key={u.id} style={styles.pendingRow}>
                      <View style={styles.pendingRowInfo}>
                        <Text style={styles.pendingRowName}>{name}</Text>
                        <Text style={styles.pendingRowMeta}>{roleLabelVal}{u.trade ? ` · ${TRADE_LABELS[u.trade] ?? u.trade}` : ''}</Text>
                      </View>
                      <View style={styles.pendingRowActions}>
                        <TouchableOpacity
                          style={[styles.pendingApproveBtn, busy && styles.pendingButtonDisabled]}
                          onPress={() => handleApproveUser(u.id)}
                          disabled={!!busy}
                        >
                          {isApproving ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={18} color="#fff" />
                              <Text style={styles.pendingApproveBtnText}>Approve</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pendingDenyBtn, busy && styles.pendingButtonDisabled]}
                          onPress={() => handleDenyUser(u.id)}
                          disabled={!!busy}
                        >
                          {isDenying ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="close-circle-outline" size={18} color="#fff" />
                              <Text style={styles.pendingDenyBtnText}>Deny</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity style={[styles.actionRow, styles.actionRowDanger]} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={22} color="#f2681c" />
              <Text style={styles.actionRowTextDanger}>Sign out</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3b3b3b',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  primaryButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#f2681c',
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4a3333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#f2681c',
    flex: 1,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
    marginLeft: 12,
  },
  keyboardView: {
    flex: 1,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4a4a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
  },
  displayName: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginTop: 12,
  },
  email: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#999',
    marginBottom: 12,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#999',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  statusActive: {
    color: '#6a6',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
  },
  editButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#999',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#3b3b3b',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#555',
  },
  saveErrorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#f2681c',
    marginTop: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#555',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f2681c',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    gap: 12,
  },
  actionRowDanger: {
    borderBottomWidth: 0,
  },
  actionRowText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  actionRowTextDanger: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
  },
  pendingEmptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    gap: 12,
  },
  pendingRowInfo: {
    flex: 1,
  },
  pendingRowName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  pendingRowMeta: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 2,
  },
  pendingRowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  pendingApproveBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  pendingDenyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#dc2626',
    borderRadius: 8,
  },
  pendingDenyBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  pendingButtonDisabled: {
    opacity: 0.6,
  },
});
