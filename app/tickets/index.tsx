import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { BUILDING_LABELS, PRIORITY_LABELS } from '../../lib/constants/tickets';
import { compareUnitNumbers } from '../../lib/utils/unitSort';
import { TicketPhoto } from '../../components/TicketPhoto';
import { getSignedTicketPhotoUrl } from '../../lib/services/tickets';
import { getHomeDemoProgress, isHomeDemoPending, markHomeDemoStep } from '../../lib/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEMO_TICKET_MARKER = '[DEMO] Tickets walkthrough';

type TicketRow = {
  id: string;
  unit_id: string;
  created_by: string;
  photo_url: string | null;
  building_element: string;
  building_elements: string[] | null;
  location_scope: 'interior' | 'exterior' | null;
  floor_level: 'basement' | '1st_floor' | '2nd_floor' | '3rd_floor' | null;
  priority: string | null;
  title: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
  units: { unit_number: string } | { unit_number: string }[] | null;
};

type UnitOption = { id: string; unit_number: string };

const PRIORITY_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const LOCATION_OPTIONS: { value: 'interior' | 'exterior' | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'interior', label: 'Interior' },
  { value: 'exterior', label: 'Exterior' },
];

const FLOOR_OPTIONS: { value: 'basement' | '1st_floor' | '2nd_floor' | '3rd_floor' | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'basement', label: 'Basement' },
  { value: '1st_floor', label: '1st' },
  { value: '2nd_floor', label: '2nd' },
  { value: '3rd_floor', label: '3rd' },
];

const BUILDING_ELEMENT_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  ...Object.entries(BUILDING_LABELS).map(([value, label]) => ({ value, label })),
];

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return true;
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function countActiveFilters(
  status: string,
  priority: string | null,
  unitId: string | null,
  buildingElement: string | null,
  locationScope: 'interior' | 'exterior' | null,
  floorLevel: 'basement' | '1st_floor' | '2nd_floor' | '3rd_floor' | null,
): number {
  let count = 0;
  if (status !== 'open') count++;
  if (priority !== null) count++;
  if (unitId !== null) count++;
  if (buildingElement !== null) count++;
  if (locationScope !== null) count++;
  if (floorLevel !== null) count++;
  return count;
}

export default function TicketsScreen() {
  const params = useLocalSearchParams<{ unitId?: string; demo?: string }>();
  const initialUnitId = params.unitId ?? '';
  const demoMode = params.demo === '1';

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterUnitId, setFilterUnitId] = useState<string | null>(initialUnitId || null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterLocationScope, setFilterLocationScope] = useState<'interior' | 'exterior' | null>(null);
  const [filterFloorLevel, setFilterFloorLevel] = useState<'basement' | '1st_floor' | '2nd_floor' | '3rd_floor' | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [filterBuildingElement, setFilterBuildingElement] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [unitsList, setUnitsList] = useState<UnitOption[]>([]);

  // Filter bottom sheet state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string>('open');
  const [draftPriority, setDraftPriority] = useState<string | null>(null);
  const [draftUnitId, setDraftUnitId] = useState<string | null>(null);
  const [draftBuildingElement, setDraftBuildingElement] = useState<string | null>(null);
  const [draftLocationScope, setDraftLocationScope] = useState<'interior' | 'exterior' | null>(null);
  const [draftFloorLevel, setDraftFloorLevel] = useState<'basement' | '1st_floor' | '2nd_floor' | '3rd_floor' | null>(null);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [elementPickerOpen, setElementPickerOpen] = useState(false);

  const [createUnitModalVisible, setCreateUnitModalVisible] = useState(false);
  const [createUnitSearch, setCreateUnitSearch] = useState('');
  const [zoomPhotoUri, setZoomPhotoUri] = useState<string | null>(null);
  const [zoomPhotoSignedUri, setZoomPhotoSignedUri] = useState<string | null>(null);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [demoUserId, setDemoUserId] = useState<string | null>(null);
  const [homeDemoPending, setHomeDemoPending] = useState(false);
  const [ticketsDemoCompleted, setTicketsDemoCompleted] = useState(false);
  const [ticketsIntroVisible, setTicketsIntroVisible] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFontTimeout(true), 5000); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (initialUnitId) setFilterUnitId(initialUnitId);
  }, [initialUnitId]);

  useEffect(() => {
    let cancelled = false;
    if (!zoomPhotoUri) {
      setZoomPhotoSignedUri(null);
      setZoomLoading(false);
      return;
    }
    setZoomLoading(true);
    getSignedTicketPhotoUrl(zoomPhotoUri)
      .then((signed) => {
        if (!cancelled) setZoomPhotoSignedUri(signed ?? zoomPhotoUri);
      })
      .finally(() => {
        if (!cancelled) setZoomLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zoomPhotoUri]);

  const fetchUnits = useCallback(async () => {
    const { data } = await supabase
      .from('units')
      .select('id, unit_number')
      .order('unit_number');
    setUnitsList((data as UnitOption[]) ?? []);
  }, []);

  const fetchTickets = useCallback(async () => {
    setFetchError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setFetchError('Sign in to see your tickets.');
      setTickets([]);
      return;
    }
    let query = supabase
      .from('tickets')
      .select('id, unit_id, created_by, title, photo_url, building_element, building_elements, location_scope, floor_level, priority, notes, status, created_at, units(unit_number)')
      .eq('status', filterStatus)
      .order('created_at', { ascending: false });
    if (filterUnitId) query = query.eq('unit_id', filterUnitId);
    if (filterPriority) query = query.eq('priority', filterPriority);
    if (filterLocationScope) query = query.eq('location_scope', filterLocationScope);
    if (filterFloorLevel) query = query.eq('floor_level', filterFloorLevel);
    if (filterBuildingElement) query = query.contains('building_elements', [filterBuildingElement]);
    let { data, error } = await query;

    if (error) {
      let fallback = supabase
        .from('tickets')
        .select('id, unit_id, created_by, title, photo_url, building_element, building_elements, location_scope, floor_level, priority, notes, status, created_at')
        .eq('status', filterStatus)
        .order('created_at', { ascending: false });
      if (filterUnitId) fallback = fallback.eq('unit_id', filterUnitId);
      if (filterPriority) fallback = fallback.eq('priority', filterPriority);
      if (filterLocationScope) fallback = fallback.eq('location_scope', filterLocationScope);
      if (filterFloorLevel) fallback = fallback.eq('floor_level', filterFloorLevel);
      if (filterBuildingElement) fallback = fallback.contains('building_elements', [filterBuildingElement]);
      const { data: dataNoJoin, error: errorNoJoin } = await fallback;
      if (!errorNoJoin && dataNoJoin?.length) {
        setTickets((dataNoJoin as TicketRow[]).map((t) => ({ ...t, units: null })));
        return;
      }
      setFetchError(error.message || 'Could not load tickets.');
      setTickets([]);
      return;
    }
    const rows = ((data as TicketRow[]) ?? []).map((t) => ({
      ...t,
      units: Array.isArray(t.units) ? (t.units[0] ?? null) : t.units,
    }));
    setTickets(rows);
  }, [filterUnitId, filterPriority, filterLocationScope, filterFloorLevel, filterBuildingElement, filterStatus]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          const uid = session?.user?.id ?? null;
          setDemoUserId(uid);
          if (uid) {
            const [pending, progress] = await Promise.all([
              isHomeDemoPending(uid),
              getHomeDemoProgress(uid),
            ]);
            if (mounted) {
              setHomeDemoPending(pending);
              setTicketsDemoCompleted(progress.tickets);
            }
          } else {
            setHomeDemoPending(false);
            setTicketsDemoCompleted(false);
          }
        }
        if (!hasLoadedRef.current) setLoading(true);
        await fetchTickets();
        hasLoadedRef.current = true;
        if (mounted) setLoading(false);
      })();
      return () => { mounted = false; };
    }, [fetchTickets])
  );

  const filterChangedAfterMount = useRef(false);
  useEffect(() => {
    if (!filterChangedAfterMount.current) {
      filterChangedAfterMount.current = true;
      return;
    }
    fetchTickets();
  }, [filterUnitId, filterPriority, filterLocationScope, filterFloorLevel, filterStatus, fetchTickets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }, [fetchTickets]);

  const showDemoTicketGuide = demoMode && homeDemoPending && !ticketsDemoCompleted;
  useEffect(() => {
    if (showDemoTicketGuide) {
      setTicketsIntroVisible(true);
    }
  }, [showDemoTicketGuide]);

  // Filter modal helpers
  const openFilterModal = useCallback(() => {
    // Initialize draft state from applied state
    setDraftStatus(filterStatus);
    setDraftPriority(filterPriority);
    setDraftUnitId(filterUnitId);
    setDraftBuildingElement(filterBuildingElement);
    setDraftLocationScope(filterLocationScope);
    setDraftFloorLevel(filterFloorLevel);
    setUnitPickerOpen(false);
    setElementPickerOpen(false);
    fetchUnits();
    setFilterModalVisible(true);
  }, [filterStatus, filterPriority, filterUnitId, filterBuildingElement, filterLocationScope, filterFloorLevel, fetchUnits]);

  const applyFilters = useCallback(() => {
    setFilterStatus(draftStatus);
    setFilterPriority(draftPriority);
    setFilterUnitId(draftUnitId);
    setFilterBuildingElement(draftBuildingElement);
    setFilterLocationScope(draftLocationScope);
    setFilterFloorLevel(draftFloorLevel);
    setFilterModalVisible(false);
  }, [draftStatus, draftPriority, draftUnitId, draftBuildingElement, draftLocationScope, draftFloorLevel]);

  const resetAllDrafts = useCallback(() => {
    setDraftStatus('open');
    setDraftPriority(null);
    setDraftUnitId(null);
    setDraftBuildingElement(null);
    setDraftLocationScope(null);
    setDraftFloorLevel(null);
    setUnitPickerOpen(false);
    setElementPickerOpen(false);
  }, []);

  const draftActiveCount = countActiveFilters(
    draftStatus,
    draftPriority,
    draftUnitId,
    draftBuildingElement,
    draftLocationScope,
    draftFloorLevel,
  );

  const appliedActiveCount = countActiveFilters(
    filterStatus,
    filterPriority,
    filterUnitId,
    filterBuildingElement,
    filterLocationScope,
    filterFloorLevel,
  );

  if (!fontsLoaded && !fontTimeout) return null;

  const searchTrimmed = searchQuery.trim();

  const sortedCreateUnits = [...unitsList].sort((a, b) => compareUnitNumbers(a.unit_number, b.unit_number));
  const filteredCreateUnits = createUnitSearch.trim()
    ? sortedCreateUnits.filter((u) => u.unit_number.toLowerCase().includes(createUnitSearch.trim().toLowerCase()))
    : sortedCreateUnits;

  const sortedFilterUnits = [...unitsList].sort((a, b) => compareUnitNumbers(a.unit_number, b.unit_number));
  const draftUnitLabel = draftUnitId
    ? (unitsList.find((u) => u.id === draftUnitId)?.unit_number ?? 'Selected unit')
    : 'All';
  const draftElementLabel = draftBuildingElement
    ? (BUILDING_LABELS[draftBuildingElement] ?? draftBuildingElement)
    : 'All';

  const displayedTickets = searchTrimmed
    ? tickets.filter((item) => {
        const unitLabelText = (item.units as { unit_number: string } | null)?.unit_number ?? '';
        const buildingText = (
          (item.building_elements && item.building_elements.length > 0 ? item.building_elements : [item.building_element])
            .filter(Boolean)
            .map((v) => BUILDING_LABELS[v] ?? v)
            .join(' ')
        );
        const locationText = item.location_scope === 'interior' ? 'Interior' : item.location_scope === 'exterior' ? 'Exterior' : '';
        const floorText =
          item.floor_level === 'basement'
            ? 'Basement'
            : item.floor_level === '1st_floor'
              ? '1st Floor'
              : item.floor_level === '2nd_floor'
                ? '2nd Floor'
                : item.floor_level === '3rd_floor'
                  ? '3rd Floor'
                  : '';
        const notesText = item.notes ?? '';
        const haystack = [unitLabelText, buildingText, locationText, floorText, notesText].join(' ');
        return fuzzyMatch(searchTrimmed, haystack);
      })
    : tickets;
  const demoTicket = displayedTickets.find((item) => (item.notes ?? '').includes(DEMO_TICKET_MARKER));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tickets</Text>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => {
            fetchUnits();
            setCreateUnitModalVisible(true);
          }}
        >
          <Ionicons name="add-circle-outline" size={28} color="#f2681c" />
        </TouchableOpacity>
      </View>

      {!fetchError && (
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#999" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search tickets"
              placeholderTextColor="#888"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={openFilterModal}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={22} color="#fff" />
            {appliedActiveCount > 0 && <View style={styles.filterBadgeDot} />}
          </TouchableOpacity>
        </View>
      )}

      {showDemoTicketGuide && (
        <View style={styles.demoTicketBanner}>
          <Text style={styles.demoTicketBannerTitle}>Tickets demo</Text>
          <Text style={styles.demoTicketBannerText}>
            Tap the highlighted Demo Ticket to continue.
          </Text>
        </View>
      )}

      {!fetchError && !loading && (
        <Text style={styles.ticketCountText}>
          {displayedTickets.length} {displayedTickets.length === 1 ? 'ticket' : 'tickets'}
        </Text>
      )}

      {/* Filter bottom sheet modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable
          style={styles.filterModalBackdrop}
          onPress={() => setFilterModalVisible(false)}
        >
          <Pressable style={styles.filterModalSheet} onPress={() => {}}>
            <View style={styles.filterGrabHandleRow}>
              <View style={styles.filterGrabHandle} />
            </View>
            <Text style={styles.filterModalTitle}>Filter by:</Text>

            <ScrollView
              style={styles.filterModalScroll}
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Status */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionLabel}>Status</Text>
                  <TouchableOpacity onPress={() => setDraftStatus('open')}>
                    <Text style={styles.filterSectionReset}>Reset</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pillRow}>
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = draftStatus === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.pill, isSelected && styles.pillSelected]}
                        onPress={() => setDraftStatus(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Priority */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionLabel}>Priority</Text>
                  <TouchableOpacity onPress={() => setDraftPriority(null)}>
                    <Text style={styles.filterSectionReset}>Reset</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pillRow}>
                  {PRIORITY_OPTIONS.map((opt) => {
                    const isSelected = draftPriority === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value ?? 'all'}
                        style={[styles.pill, isSelected && styles.pillSelected]}
                        onPress={() => setDraftPriority(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Unit — dropdown selector */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionLabel}>Unit</Text>
                  <TouchableOpacity onPress={() => { setDraftUnitId(null); setUnitPickerOpen(false); }}>
                    <Text style={styles.filterSectionReset}>Reset</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.dropdownSelector}
                  onPress={() => { setUnitPickerOpen(!unitPickerOpen); setElementPickerOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownSelectorText, draftUnitId && styles.dropdownSelectorTextActive]}>
                    {draftUnitLabel}
                  </Text>
                  <Ionicons
                    name={unitPickerOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#999"
                  />
                </TouchableOpacity>
                {unitPickerOpen && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    <TouchableOpacity
                      style={[styles.dropdownItem, draftUnitId === null && styles.dropdownItemSelected]}
                      onPress={() => { setDraftUnitId(null); setUnitPickerOpen(false); }}
                    >
                      <Text style={[styles.dropdownItemText, draftUnitId === null && styles.dropdownItemTextSelected]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {sortedFilterUnits.map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.dropdownItem, draftUnitId === u.id && styles.dropdownItemSelected]}
                        onPress={() => { setDraftUnitId(u.id); setUnitPickerOpen(false); }}
                      >
                        <Text style={[styles.dropdownItemText, draftUnitId === u.id && styles.dropdownItemTextSelected]}>
                          {u.unit_number}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Building Element — dropdown selector */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionLabel}>Building Element</Text>
                  <TouchableOpacity onPress={() => { setDraftBuildingElement(null); setElementPickerOpen(false); }}>
                    <Text style={styles.filterSectionReset}>Reset</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.dropdownSelector}
                  onPress={() => { setElementPickerOpen(!elementPickerOpen); setUnitPickerOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownSelectorText, draftBuildingElement && styles.dropdownSelectorTextActive]}>
                    {draftElementLabel}
                  </Text>
                  <Ionicons
                    name={elementPickerOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#999"
                  />
                </TouchableOpacity>
                {elementPickerOpen && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {BUILDING_ELEMENT_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value ?? 'all'}
                        style={[styles.dropdownItem, draftBuildingElement === opt.value && styles.dropdownItemSelected]}
                        onPress={() => { setDraftBuildingElement(opt.value); setElementPickerOpen(false); }}
                      >
                        <Text style={[styles.dropdownItemText, draftBuildingElement === opt.value && styles.dropdownItemTextSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Location */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionLabel}>Location</Text>
                  <TouchableOpacity onPress={() => setDraftLocationScope(null)}>
                    <Text style={styles.filterSectionReset}>Reset</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pillRow}>
                  {LOCATION_OPTIONS.map((opt) => {
                    const isSelected = draftLocationScope === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value ?? 'all'}
                        style={[styles.pill, isSelected && styles.pillSelected]}
                        onPress={() => setDraftLocationScope(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Floor */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionLabel}>Floor</Text>
                  <TouchableOpacity onPress={() => setDraftFloorLevel(null)}>
                    <Text style={styles.filterSectionReset}>Reset</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pillRow}>
                  {FLOOR_OPTIONS.map((opt) => {
                    const isSelected = draftFloorLevel === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value ?? 'all'}
                        style={[styles.pill, isSelected && styles.pillSelected]}
                        onPress={() => setDraftFloorLevel(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Spacer for bottom buttons */}
              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Bottom action buttons */}
            <View style={styles.filterModalActions}>
              <TouchableOpacity
                style={styles.resetAllButton}
                onPress={resetAllDrafts}
                activeOpacity={0.7}
              >
                <Text style={styles.resetAllButtonText}>Reset All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={applyFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.applyButtonText}>
                  Apply Filters{draftActiveCount > 0 ? `(${draftActiveCount})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create ticket: unit picker modal */}
      <Modal visible={createUnitModalVisible} transparent animationType="slide" onRequestClose={() => { setCreateUnitModalVisible(false); setCreateUnitSearch(''); }}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => { setCreateUnitModalVisible(false); setCreateUnitSearch(''); }}>
          <TouchableOpacity style={styles.pickerModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Select a unit</Text>
            <View style={styles.createUnitSearchWrap}>
              <Ionicons name="search-outline" size={16} color="#999" />
              <TextInput
                style={styles.createUnitSearchInput}
                value={createUnitSearch}
                onChangeText={setCreateUnitSearch}
                placeholder="Search by building name..."
                placeholderTextColor="#888"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {createUnitSearch.length > 0 && (
                <TouchableOpacity onPress={() => setCreateUnitSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.pickerScroll}>
              {filteredCreateUnits.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    setCreateUnitModalVisible(false);
                    setCreateUnitSearch('');
                    router.push({
                      pathname: '/tickets/create',
                      params: { unitId: u.id, unitName: u.unit_number },
                    });
                  }}
                >
                  <Text style={styles.pickerRowText}>{u.unit_number}</Text>
                </TouchableOpacity>
              ))}
              {filteredCreateUnits.length === 0 && (
                <Text style={styles.emptyPickerText}>No matching units</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => { setCreateUnitModalVisible(false); setCreateUnitSearch(''); }}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f2681c" />
        </View>
      ) : fetchError ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color="#f2681c" />
          <Text style={styles.emptyTitle}>Could not load tickets</Text>
          <Text style={styles.emptySubtitle}>{fetchError}</Text>
          {fetchError === 'Sign in to see your tickets.' ? (
            <TouchableOpacity style={styles.backToHomeButton} onPress={navigateToSignIn}>
              <Text style={styles.backToHomeButtonText}>Sign in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.backToHomeButton} onPress={() => fetchTickets()}>
              <Text style={styles.backToHomeButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : displayedTickets.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="ticket-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>
            {searchTrimmed ? 'No matching tickets' : filterStatus === 'open' ? 'No open tickets' : filterStatus === 'in_progress' ? 'No in-progress tickets' : 'No completed tickets'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchTrimmed
              ? 'Try a different search or clear filters.'
              : filterStatus === 'open'
              ? 'Create a ticket from the home screen or change filters.'
              : filterStatus === 'in_progress'
              ? 'In-progress tickets will appear here.'
              : 'Completed tickets will appear here.'}
          </Text>
          <TouchableOpacity
            style={styles.backToHomeButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.backToHomeButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayedTickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f2681c"
            />
          }
          renderItem={({ item }) => {
            const displayElements = (item.building_elements && item.building_elements.length > 0
              ? item.building_elements
              : [item.building_element]
            )
              .filter(Boolean)
              .map((v) => BUILDING_LABELS[v] ?? v)
              .join(', ');
            return (
            <TouchableOpacity
              style={[
                styles.ticketCard,
                showDemoTicketGuide && demoTicket?.id === item.id && styles.demoTicketCardHighlight,
              ]}
              activeOpacity={0.8}
              onPress={async () => {
                if (showDemoTicketGuide && demoTicket?.id !== item.id) {
                  Alert.alert('Demo step', 'Tap the highlighted Demo Ticket first.');
                  return;
                }
                if (showDemoTicketGuide && demoTicket?.id === item.id && demoUserId) {
                  await markHomeDemoStep(demoUserId, 'tickets');
                  setTicketsDemoCompleted(true);
                }
                router.push({
                  pathname: '/tickets/[id]',
                  params: {
                    id: item.id,
                    demoBoard: showDemoTicketGuide && demoTicket?.id === item.id ? '1' : undefined,
                  },
                });
              }}
            >
              {item.photo_url ? (
                <TouchableOpacity
                  style={styles.ticketThumbWrap}
                  activeOpacity={0.9}
                  onPress={(e) => {
                    e.stopPropagation();
                    setZoomPhotoUri(item.photo_url);
                  }}
                >
                  <TicketPhoto uri={item.photo_url} style={styles.ticketThumb} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <View style={styles.ticketThumbPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#666" />
                </View>
              )}
              <View style={styles.ticketBody}>
                <Text style={styles.ticketTitle} numberOfLines={1}>
                  {item.title || displayElements || 'Untitled'}
                </Text>
                <Text style={styles.ticketUnit}>
                  {(item.units as { unit_number: string } | null)?.unit_number ?? 'Unit'}
                  {displayElements && item.title ? `  ·  ${displayElements}` : ''}
                </Text>
                <View style={styles.ticketMeta}>
                  <Text
                    style={[
                      styles.ticketStatus,
                      item.status === 'open' && styles.ticketStatusOpen,
                      item.status === 'in_progress' && styles.ticketStatusInProgress,
                      item.status === 'completed' && styles.ticketStatusCompleted,
                    ]}
                  >
                    {item.status === 'in_progress' ? 'In Progress' : item.status === 'completed' ? 'Completed' : 'Open'}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      item.priority === 'high' && styles.badgeHigh,
                      item.priority === 'medium' && styles.badgeMedium,
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {PRIORITY_LABELS[item.priority ?? 'medium'] ?? item.priority}
                    </Text>
                  </View>
                  <Text style={styles.ticketDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!zoomPhotoUri} transparent animationType="fade">
        <View style={styles.zoomBackdrop}>
          <View style={styles.zoomContent}>
            <ScrollView
              style={styles.zoomScroll}
              contentContainerStyle={styles.zoomScrollContent}
              maximumZoomScale={6}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              {zoomLoading ? (
                <View style={[styles.zoomPhotoPlaceholder, { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }]}>
                  <ActivityIndicator size="large" color="#f2681c" />
                </View>
              ) : zoomPhotoSignedUri ? (
                <Image
                  source={{ uri: zoomPhotoSignedUri }}
                  style={[styles.zoomPhoto, { width: SCREEN_WIDTH, minHeight: SCREEN_WIDTH * 1.2 }]}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.zoomPhotoPlaceholder, { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }]}>
                  <Ionicons name="image-outline" size={42} color="#666" />
                </View>
              )}
            </ScrollView>
            <Text style={styles.zoomHelperText}>Pinch to zoom • Drag to pan</Text>
            <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomPhotoUri(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={ticketsIntroVisible} transparent animationType="fade" onRequestClose={() => setTicketsIntroVisible(false)}>
        <View style={styles.zoomBackdrop}>
          <View style={styles.ticketsIntroModal}>
            <Text style={styles.ticketsIntroTitle}>Tickets</Text>
            <Text style={styles.ticketsIntroText}>
              This is where all tickets live. Open the highlighted Demo Ticket for a quick walkthrough.
            </Text>
            <TouchableOpacity style={styles.ticketsIntroButton} onPress={() => setTicketsIntroVisible(false)}>
              <Text style={styles.ticketsIntroButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2e2e2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  headerRight: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3a3a3a',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    paddingVertical: 0,
  },
  filterIconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f2681c',
  },
  ticketCountText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  // Filter bottom sheet modal
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModalSheet: {
    backgroundColor: '#2e2e2e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  filterGrabHandleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  filterGrabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
  },
  filterModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  filterModalScroll: {
    paddingHorizontal: 20,
  },
  filterSection: {
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#444',
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterSectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  filterSectionReset: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#f2681c',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: 'transparent',
  },
  pillSelected: {
    backgroundColor: '#f2681c',
    borderColor: '#f2681c',
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  pillTextSelected: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#3a3a3a',
    marginBottom: 4,
  },
  dropdownSelectorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  dropdownSelectorTextActive: {
    color: '#fff',
  },
  dropdownList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    backgroundColor: '#3a3a3a',
    marginTop: 4,
    marginBottom: 4,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#444',
  },
  dropdownItemSelected: {
    backgroundColor: '#4a4a4a',
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  dropdownItemTextSelected: {
    color: '#f2681c',
    fontFamily: 'Inter_600SemiBold',
  },
  filterModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  resetAllButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f2681c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetAllButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f2681c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  // Create unit modal (kept from original)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#2e2e2e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  pickerScroll: {
    maxHeight: 320,
  },
  pickerRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#444',
  },
  pickerRowText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  pickerClose: {
    marginTop: 16,
    marginHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f2681c',
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  createUnitSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3a3a3a',
  },
  createUnitSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    paddingVertical: 0,
  },
  emptyPickerText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    paddingHorizontal: 20,
    paddingVertical: 24,
    textAlign: 'center',
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
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  backToHomeButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f2681c',
    borderRadius: 8,
  },
  backToHomeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  ticketThumb: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#2e2e2e',
  },
  ticketThumbWrap: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  ticketThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#2e2e2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketBody: {
    flex: 1,
    marginLeft: 12,
  },
  ticketTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  ticketUnit: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 2,
  },
  ticketElement: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 2,
  },
  ticketSubMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#777',
    marginTop: 2,
  },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#555',
  },
  badgeHigh: {
    backgroundColor: '#a33',
  },
  badgeMedium: {
    backgroundColor: '#8a6a1f',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  ticketStatus: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  ticketStatusOpen: {
    color: '#6fcf7a',
  },
  ticketStatusInProgress: {
    color: '#facc15',
  },
  ticketStatusCompleted: {
    color: '#9aa3af',
  },
  ticketDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginLeft: 'auto',
  },
  demoTicketBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f2681c',
    backgroundColor: '#3a3a3a',
  },
  demoTicketBannerTitle: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  demoTicketBannerText: {
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  demoTicketCardHighlight: {
    borderColor: '#f2681c',
    borderWidth: 1.5,
  },
  ticketsIntroModal: {
    width: '88%',
    backgroundColor: '#2e2e2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#444',
    padding: 16,
  },
  ticketsIntroTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  ticketsIntroText: {
    marginTop: 8,
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  ticketsIntroButton: {
    marginTop: 14,
    backgroundColor: '#f2681c',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ticketsIntroButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  zoomScroll: {
    flex: 1,
  },
  zoomScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomPhoto: {
    backgroundColor: '#333',
  },
  zoomPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomHelperText: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
