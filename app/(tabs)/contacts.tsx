import { useState, useCallback, useRef } from 'react';
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
  Modal,
  FlatList,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { router } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { supabase } from '../../lib/supabase/client';
import { TRADE_LABELS } from '../../lib/constants/tickets';
import { ROLE_TYPE_OPTIONS } from '../../lib/constants/tickets';
import { formatPhoneNumberDisplay, normalizePhoneDigits } from '../../lib/utils/phone';

type Contact = {
  id: string;
  company_name: string | null;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  trade: string | null;
  unit_numbers: string[];
};

const ROLE_ORDER = ['owner', 'project_manager', 'designer', 'developer', 'subcontractor'] as const;

type RoleFilter = 'all' | (typeof ROLE_ORDER)[number];

const TRADE_KEYS = Object.keys(TRADE_LABELS);

function roleSectionTitle(role: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'project_manager') return 'Project Manager';
  if (role === 'designer') return 'Designer';
  if (role === 'developer') return 'Developer';
  if (role === 'subcontractor') return 'Subcontractor';
  return role;
}

export default function ContactsScreen() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [tradeFilter, setTradeFilter] = useState<string | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [specialtyModalVisible, setSpecialtyModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

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

    const { data: contactRows, error: profilesErr } = await supabase
      .from('contacts')
      .select('id, company_name, profile_id, first_name, last_name, phone, email, role, trade')
      .eq('status', 'active')
      .is('merged_into_contact_id', null)
      .order('company_name', { ascending: true })
      .order('last_name', { ascending: true });

    if (profilesErr) {
      setError(profilesErr.message || 'Could not load contacts.');
      setContacts([]);
      return;
    }

    const profileIds = (contactRows ?? [])
      .map((p: { profile_id: string | null }) => p.profile_id)
      .filter((id): id is string => Boolean(id));
    let assignments: { user_id: string; units: { unit_number: string } | { unit_number: string }[] | null }[] = [];
    if (profileIds.length > 0) {
      const { data: assignmentRows } = await supabase
        .from('unit_assignments')
        .select('user_id, unit_id, units(unit_number)')
        .in('user_id', profileIds)
        .in('assignment_type', ['project_manager', 'designer']);
      assignments = (assignmentRows as typeof assignments) ?? [];
    }

    const unitsByUserId: Record<string, string[]> = {};
    assignments.forEach((a: { user_id: string; units: { unit_number: string } | { unit_number: string }[] | null }) => {
      const u = Array.isArray(a.units) ? a.units[0] : a.units;
      const num = u?.unit_number;
      if (num) {
        if (!unitsByUserId[a.user_id]) unitsByUserId[a.user_id] = [];
        unitsByUserId[a.user_id].push(num);
      }
    });

    const list: Contact[] = (contactRows ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      company_name: (p.company_name as string | null) ?? null,
      profile_id: (p.profile_id as string | null) ?? null,
      first_name: p.first_name as string | null,
      last_name: p.last_name as string | null,
      phone: p.phone as string | null,
      email: p.email as string | null,
      role: p.role as string | null,
      trade: p.trade as string | null,
      unit_numbers: p.profile_id ? (unitsByUserId[p.profile_id as string] ?? []) : [],
    }));

    setContacts(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        if (!hasLoadedRef.current) setLoading(true);
        await fetchContacts();
        hasLoadedRef.current = true;
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
    const dialable = normalizePhoneDigits(phone);
    if (!dialable) return;
    const url = `tel:${dialable}`;
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

  const filteredByRole =
    roleFilter === 'all'
      ? contacts
      : contacts.filter((c) => c.role === roleFilter);

  const filteredByTrade =
    roleFilter === 'subcontractor' && tradeFilter
      ? filteredByRole.filter((c) => c.trade === tradeFilter)
      : filteredByRole;

  const searchTrimmed = searchQuery.trim().toLowerCase();
  const filteredContacts = searchTrimmed
    ? filteredByTrade.filter((c) => {
        const first = (c.first_name ?? '').toLowerCase();
        const last = (c.last_name ?? '').toLowerCase();
        const company = (c.company_name ?? '').toLowerCase();
        const full = `${first} ${last}`.trim();
        const reverse = `${last} ${first}`.trim();
        return (
          full.includes(searchTrimmed) ||
          reverse.includes(searchTrimmed) ||
          first.includes(searchTrimmed) ||
          last.includes(searchTrimmed) ||
          company.includes(searchTrimmed)
        );
      })
    : filteredByTrade;

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    list: filteredContacts.filter((c) => c.role === role),
  })).filter((s) => s.list.length > 0);

  const showSpecialtyFilter = roleFilter === 'subcontractor';
  const roleFilterLabel = roleFilter === 'all' ? 'All' : roleSectionTitle(roleFilter);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name"
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <View style={styles.filterControls}>
          <TouchableOpacity
            style={[styles.filterControlButton, roleFilter !== 'all' && styles.filterButtonActive]}
            onPress={() => setRoleModalVisible(true)}
          >
            <Text style={[styles.filterButtonText, roleFilter !== 'all' && styles.filterButtonTextActive]}>
              Role: {roleFilterLabel}
            </Text>
            <Ionicons name="chevron-down" size={18} color={roleFilter !== 'all' ? '#fff' : '#999'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addContactButton}
            onPress={() => router.push('/contacts/add')}
          >
            <Ionicons name="person-add-outline" size={16} color="#fff" />
            <Text style={styles.addContactButtonText}>Add Contact</Text>
          </TouchableOpacity>
          {showSpecialtyFilter && (
            <TouchableOpacity
              style={[styles.filterControlButton, tradeFilter && styles.filterButtonActive]}
              onPress={() => setSpecialtyModalVisible(true)}
            >
              <Text style={[styles.filterButtonText, tradeFilter && styles.filterButtonTextActive]}>
                Specialty: {tradeFilter ? TRADE_LABELS[tradeFilter] ?? tradeFilter : 'All'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={tradeFilter ? '#fff' : '#999'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={roleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRoleModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Role</Text>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={28} color="#999" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ key: 'all', label: 'All' }, ...ROLE_ORDER.map((r) => ({ key: r, label: roleSectionTitle(r) }))]}
              keyExtractor={(item) => item.key}
              style={styles.modalList}
              renderItem={({ item }) => {
                const selected = roleFilter === item.key;
                return (
                  <TouchableOpacity
                    style={[styles.modalRow, selected && styles.modalRowSelected]}
                    onPress={() => {
                      const nextRole = item.key as RoleFilter;
                      setRoleFilter(nextRole);
                      if (nextRole !== 'subcontractor') setTradeFilter(null);
                      setRoleModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalRowText, selected && styles.modalRowTextSelected]}>
                      {item.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={22} color="#f2681c" />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={specialtyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSpecialtyModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSpecialtyModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Specialty</Text>
              <TouchableOpacity onPress={() => setSpecialtyModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={28} color="#999" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ key: '__all__', label: 'All' }, ...TRADE_KEYS.map((k) => ({ key: k, label: TRADE_LABELS[k] ?? k }))]}
              keyExtractor={(item) => item.key}
              style={styles.modalList}
              renderItem={({ item }) => {
                const selected = item.key === '__all__' ? tradeFilter === null : tradeFilter === item.key;
                return (
                  <TouchableOpacity
                    style={[styles.modalRow, selected && styles.modalRowSelected]}
                    onPress={() => {
                      setTradeFilter(item.key === '__all__' ? null : item.key);
                      setSpecialtyModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalRowText, selected && styles.modalRowTextSelected]}>
                      {item.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={22} color="#f2681c" />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selectedContact != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedContact(null)}
      >
        <TouchableOpacity style={styles.contactModalOverlay} activeOpacity={1} onPress={() => setSelectedContact(null)}>
          <TouchableOpacity style={styles.contactModalCard} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.contactModalName}>
              {selectedContact ? ([selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' ') || '—') : '—'}
            </Text>
            <Text style={styles.contactModalPhone}>
              {selectedContact?.phone ? formatPhoneNumberDisplay(selectedContact.phone) : 'No phone number'}
            </Text>
            {selectedContact?.unit_numbers?.length ? (
              <View style={styles.contactModalUnitsWrap}>
                <Text style={styles.contactModalUnitsLabel}>Assigned units</Text>
                <View style={styles.unitsChips}>
                  {[...selectedContact.unit_numbers].sort().map((num) => (
                    <View key={num} style={styles.unitChip}>
                      <Text style={styles.unitChipText}>{num}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.actionButton, styles.contactModalCallButton]}
              onPress={() => handleCall(selectedContact?.phone ?? null)}
              disabled={!selectedContact?.phone?.trim()}
            >
              <Ionicons name="call-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedContact(null)}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
          <Text style={styles.emptyTitle}>
            {contacts.length === 0
              ? 'No contacts yet'
              : 'No contacts match this filter'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {contacts.length === 0
              ? 'Contacts will appear here by role.'
              : 'Try a different role, specialty, or search.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2681c" />
          }
          showsVerticalScrollIndicator={false}
        >
          {byRole.map(({ role, list }) => (
            <View key={role} style={styles.section}>
              <Text style={styles.sectionTitle}>{roleSectionTitle(role)}</Text>
              {list.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.card}
                  activeOpacity={0.86}
                  onPress={() => setSelectedContact(c)}
                >
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                    </Text>
                    <View style={[styles.kindBadge, c.profile_id ? styles.kindBadgeLinked : styles.kindBadgeExternal]}>
                      <Text style={styles.kindBadgeText}>{c.profile_id ? 'App user' : 'External'}</Text>
                    </View>
                  </View>
                  {c.company_name ? (
                    <Text style={styles.contactPerson}>{c.company_name}</Text>
                  ) : null}
                  {c.phone ? (
                    <Text style={styles.phone}>{formatPhoneNumberDisplay(c.phone)}</Text>
                  ) : (
                    <Text style={styles.phoneMuted}>No phone</Text>
                  )}
                  {c.role === 'subcontractor' && c.trade && (
                    <Text style={styles.trade}>{TRADE_LABELS[c.trade] ?? c.trade}</Text>
                  )}
                  {(c.role === 'project_manager' || c.role === 'designer' || c.role === 'developer') &&
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
                      onPress={(e) => {
                        e.stopPropagation();
                        handleCall(c.phone);
                      }}
                      disabled={!c.phone?.trim()}
                    >
                      <Ionicons name="call-outline" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Call</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
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
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f2681c',
    borderRadius: 8,
  },
  addContactButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  searchInput: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  filterControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  filterControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
    alignSelf: 'flex-start',
  },
  filterButtonActive: {
    backgroundColor: '#f2681c',
  },
  filterButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#999',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  contactModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#3b3b3b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  contactModalCard: {
    width: '88%',
    backgroundColor: '#3b3b3b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4a4a',
    padding: 18,
  },
  contactModalName: {
    fontSize: 22,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  contactModalPhone: {
    fontSize: 15,
    color: '#d1d5db',
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
  contactModalUnitsWrap: {
    marginTop: 14,
  },
  contactModalUnitsLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  contactModalCallButton: {
    marginTop: 16,
    justifyContent: 'center',
  },
  modalCloseButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#555',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  modalList: {
    maxHeight: 400,
    paddingBottom: 24,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#4a4a4a',
  },
  modalRowSelected: {
    backgroundColor: '#4a4a4a',
  },
  modalRowText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  modalRowTextSelected: {
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kindBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  kindBadgeLinked: {
    backgroundColor: '#38533f',
  },
  kindBadgeExternal: {
    backgroundColor: '#555',
  },
  kindBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  contactPerson: {
    fontSize: 13,
    color: '#aaa',
    fontFamily: 'Inter_400Regular',
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
