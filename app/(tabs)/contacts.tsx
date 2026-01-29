import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { navigateToSignIn } from '../../lib/navigation';
import { supabase } from '../../lib/supabase/client';
import { TRADE_LABELS } from '../../lib/constants/tickets';
import { ROLE_TYPE_OPTIONS } from '../../lib/constants/tickets';

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  trade: string | null;
  unit_numbers: string[];
};

const ROLE_ORDER = ['owner', 'project_manager', 'internal_developer', 'subcontractor'] as const;

function roleSectionTitle(role: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'project_manager') return 'Project Manager';
  if (role === 'internal_developer') return 'Internal Developer';
  if (role === 'subcontractor') return 'Subcontractor';
  return role;
}

export default function ContactsScreen() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const fetchContacts = useCallback(async () => {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setContacts([]);
      setHasSession(false);
      return;
    }
    setHasSession(true);

    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, email, role, trade')
      .eq('status', 'active')
      .order('last_name', { ascending: true });

    if (profilesErr) {
      setError(profilesErr.message || 'Could not load contacts.');
      setContacts([]);
      return;
    }

    const profileIds = (profiles ?? []).map((p: { id: string }) => p.id);
    const { data: assignments } = await supabase
      .from('unit_assignments')
      .select('user_id, unit_id, units(unit_number)')
      .in('user_id', profileIds)
      .in('assignment_type', ['project_manager', 'internal_developer']);

    const unitsByUserId: Record<string, string[]> = {};
    (assignments ?? []).forEach((a: { user_id: string; units: { unit_number: string } | { unit_number: string }[] | null }) => {
      const u = Array.isArray(a.units) ? a.units[0] : a.units;
      const num = u?.unit_number;
      if (num) {
        if (!unitsByUserId[a.user_id]) unitsByUserId[a.user_id] = [];
        unitsByUserId[a.user_id].push(num);
      }
    });

    const list: Contact[] = (profiles ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      first_name: p.first_name as string | null,
      last_name: p.last_name as string | null,
      phone: p.phone as string | null,
      email: p.email as string | null,
      role: p.role as string | null,
      trade: p.trade as string | null,
      unit_numbers: unitsByUserId[p.id as string] ?? [],
    }));

    setContacts(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        await fetchContacts();
        if (mounted) setLoading(false);
      })();
      return () => { mounted = false; };
    }, [fetchContacts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchContacts();
    setRefreshing(false);
  }, [fetchContacts]);

  const handleCall = useCallback((phone: string | null) => {
    if (!phone?.trim()) return;
    const url = `tel:${phone.trim()}`;
    Linking.canOpenURL(url).then((can) => {
      if (can) Linking.openURL(url);
      else Alert.alert('Not supported', 'Calling is not available on this device.');
    }).catch(() => Alert.alert('Error', 'Could not open phone.'));
  }, []);

  if (hasSession === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.text}>Sign in to see contacts.</Text>
          <TouchableOpacity style={styles.signInButton} onPress={navigateToSignIn}>
            <Text style={styles.signInButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!fontsLoaded) return null;

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    list: contacts.filter((c) => c.role === role),
  })).filter((s) => s.list.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f2681c" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchContacts()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : byRole.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.emptySubtitle}>Active users will appear here by role.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2681c" />
          }
          showsVerticalScrollIndicator={false}
        >
          {byRole.map(({ role, list }) => (
            <View key={role} style={styles.section}>
              <Text style={styles.sectionTitle}>{roleSectionTitle(role)}</Text>
              {list.map((c) => (
                <View key={c.id} style={styles.card}>
                  <Text style={styles.name}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                  </Text>
                  {c.phone ? (
                    <Text style={styles.phone}>{c.phone}</Text>
                  ) : (
                    <Text style={styles.phoneMuted}>No phone</Text>
                  )}
                  {c.role === 'subcontractor' && c.trade && (
                    <Text style={styles.trade}>{TRADE_LABELS[c.trade] ?? c.trade}</Text>
                  )}
                  {(c.role === 'project_manager' || c.role === 'internal_developer') &&
                    c.unit_numbers.length > 0 && (
                      <View style={styles.unitsWrap}>
                        <Text style={styles.unitsLabel}>Units: </Text>
                        <View style={styles.unitsChips}>
                          {[...c.unit_numbers].sort().map((num) => (
                            <View key={num} style={styles.unitChip}>
                              <Text style={styles.unitChipText}>{num}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleCall(c.phone)}
                      disabled={!c.phone?.trim()}
                    >
                      <Ionicons name="call-outline" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Call</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3b3b3b' },
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
  text: { color: '#ccc', fontSize: 18, marginBottom: 16 },
  signInButton: {
    backgroundColor: '#f2681c',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  signInButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#f2681c', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryButton: { backgroundColor: '#f2681c', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: '#fff', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginBottom: 4,
  },
  phone: { fontSize: 15, color: '#ccc', fontFamily: 'Inter_400Regular', marginBottom: 4 },
  phoneMuted: { fontSize: 15, color: '#888', fontFamily: 'Inter_400Regular', marginBottom: 4 },
  trade: { fontSize: 13, color: '#aaa', fontFamily: 'Inter_400Regular', marginBottom: 4 },
  unitsWrap: { marginBottom: 10 },
  unitsLabel: { fontSize: 13, color: '#aaa', fontFamily: 'Inter_400Regular', marginBottom: 6 },
  unitsChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitChip: {
    backgroundColor: '#555',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  unitChipText: { fontSize: 12, color: '#ccc', fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f2681c',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
