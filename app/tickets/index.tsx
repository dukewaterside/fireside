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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { BUILDING_LABELS, PRIORITY_LABELS } from '../../lib/constants/tickets';
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

const STATUS_OPTIONS: { value: 'open' | 'completed'; label: string }[] = [
  { value: 'open', label: 'Open' },
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
  { value: '1st_floor', label: '1st Floor' },
  { value: '2nd_floor', label: '2nd Floor' },
  { value: '3rd_floor', label: '3rd Floor' },
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
  const [filterStatus, setFilterStatus] = useState<'open' | 'completed'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [unitsList, setUnitsList] = useState<UnitOption[]>([]);
  const [modalUnit, setModalUnit] = useState(false);
  const [modalSeverity, setModalSeverity] = useState(false);
  const [modalLocation, setModalLocation] = useState(false);
  const [modalFloor, setModalFloor] = useState(false);
  const [modalStatus, setModalStatus] = useState(false);
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
      .select('id, unit_id, created_by, photo_url, building_element, building_elements, location_scope, floor_level, priority, notes, status, created_at, units(unit_number)')
      .eq('status', filterStatus)
      .order('created_at', { ascending: false });
    if (filterUnitId) query = query.eq('unit_id', filterUnitId);
    if (filterPriority) query = query.eq('priority', filterPriority);
    if (filterLocationScope) query = query.eq('location_scope', filterLocationScope);
    if (filterFloorLevel) query = query.eq('floor_level', filterFloorLevel);
    let { data, error } = await query;

    if (error) {
      let fallback = supabase
        .from('tickets')
        .select('id, unit_id, created_by, photo_url, building_element, building_elements, location_scope, floor_level, priority, notes, status, created_at')
        .eq('status', filterStatus)
        .order('created_at', { ascending: false });
      if (filterUnitId) fallback = fallback.eq('unit_id', filterUnitId);
      if (filterPriority) fallback = fallback.eq('priority', filterPriority);
      if (filterLocationScope) fallback = fallback.eq('location_scope', filterLocationScope);
      if (filterFloorLevel) fallback = fallback.eq('floor_level', filterFloorLevel);
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
  }, [filterUnitId, filterPriority, filterLocationScope, filterFloorLevel, filterStatus]);

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

  if (!fontsLoaded) return null;

  const searchTrimmed = searchQuery.trim();
  const selectedUnitLabel = filterUnitId
    ? (unitsList.find((u) => u.id === filterUnitId)?.unit_number ?? 'Selected unit')
    : null;
  const selectedSeverityLabel = filterPriority ? (PRIORITY_LABELS[filterPriority] ?? filterPriority) : null;
  const selectedLocationLabel = filterLocationScope
    ? (filterLocationScope === 'interior' ? 'Interior' : 'Exterior')
    : null;
  const selectedFloorLabel = filterFloorLevel
    ? (
      filterFloorLevel === 'basement'
        ? 'Basement'
        : filterFloorLevel === '1st_floor'
          ? '1st Floor'
          : filterFloorLevel === '2nd_floor'
            ? '2nd Floor'
            : '3rd Floor'
    )
    : null;
  const selectedStatusLabel = filterStatus === 'completed' ? 'Completed' : null;

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
        <View style={styles.headerRight} />
      </View>

      {!fetchError && (
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
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedUnitLabel && styles.filterChipActive]}
            onPress={() => {
              fetchUnits();
              setModalUnit(true);
            }}
          >
            <Text style={[styles.filterChipText, selectedUnitLabel && styles.filterChipTextActive]} numberOfLines={1}>
              {selectedUnitLabel ?? 'Unit'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, selectedSeverityLabel && styles.filterChipActive]} onPress={() => setModalSeverity(true)}>
            <Text style={[styles.filterChipText, selectedSeverityLabel && styles.filterChipTextActive]} numberOfLines={1}>
              {selectedSeverityLabel ?? 'Severity'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, selectedLocationLabel && styles.filterChipActive]} onPress={() => setModalLocation(true)}>
            <Text style={[styles.filterChipText, selectedLocationLabel && styles.filterChipTextActive]} numberOfLines={1}>
              {selectedLocationLabel ?? 'Location'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, selectedFloorLabel && styles.filterChipActive]} onPress={() => setModalFloor(true)}>
            <Text style={[styles.filterChipText, selectedFloorLabel && styles.filterChipTextActive]} numberOfLines={1}>
              {selectedFloorLabel ?? 'Floor'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, selectedStatusLabel && styles.filterChipActive]} onPress={() => setModalStatus(true)}>
            <Text style={[styles.filterChipText, selectedStatusLabel && styles.filterChipTextActive]} numberOfLines={1}>
              {selectedStatusLabel ?? 'Status'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Unit filter modal */}
      <Modal visible={modalUnit} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalUnit(false)}>
          <TouchableOpacity style={styles.pickerModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Unit</Text>
            <ScrollView style={styles.pickerScroll}>
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => {
                  setFilterUnitId(null);
                  setModalUnit(false);
                }}
              >
                <Text style={styles.pickerRowText}>All units</Text>
              </TouchableOpacity>
              {unitsList.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    setFilterUnitId(u.id);
                    setModalUnit(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{u.unit_number}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setModalUnit(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Severity filter modal */}
      <Modal visible={modalSeverity} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalSeverity(false)}>
          <TouchableOpacity style={styles.pickerModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Severity</Text>
            <ScrollView style={styles.pickerScroll}>
              {PRIORITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value ?? 'all'}
                  style={styles.pickerRow}
                  onPress={() => {
                    setFilterPriority(opt.value);
                    setModalSeverity(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setModalSeverity(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Status filter modal */}
      <Modal visible={modalStatus} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalStatus(false)}>
          <TouchableOpacity style={styles.pickerModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Status</Text>
            <ScrollView style={styles.pickerScroll}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.pickerRow}
                  onPress={() => {
                    setFilterStatus(opt.value);
                    setModalStatus(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setModalStatus(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Interior/Exterior filter modal */}
      <Modal visible={modalLocation} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalLocation(false)}>
          <TouchableOpacity style={styles.pickerModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Interior / Exterior</Text>
            <ScrollView style={styles.pickerScroll}>
              {LOCATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value ?? 'all'}
                  style={styles.pickerRow}
                  onPress={() => {
                    setFilterLocationScope(opt.value);
                    setModalLocation(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setModalLocation(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Floor filter modal */}
      <Modal visible={modalFloor} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalFloor(false)}>
          <TouchableOpacity style={styles.pickerModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Floor</Text>
            <ScrollView style={styles.pickerScroll}>
              {FLOOR_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value ?? 'all'}
                  style={styles.pickerRow}
                  onPress={() => {
                    setFilterFloorLevel(opt.value);
                    setModalFloor(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setModalFloor(false)}>
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
            {searchTrimmed ? 'No matching tickets' : filterStatus === 'open' ? 'No open tickets' : 'No completed tickets'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchTrimmed
              ? 'Try a different search or clear filters.'
              : filterStatus === 'open'
              ? 'Create a ticket from the home screen or change filters.'
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
                <Text style={styles.ticketUnit}>
                  {(item.units as { unit_number: string } | null)?.unit_number ?? 'Unit'}
                </Text>
                <Text style={styles.ticketElement}>
                  {displayElements}
                </Text>
                <Text style={styles.ticketSubMeta}>
                  {(item.location_scope === 'interior' ? 'Interior' : item.location_scope === 'exterior' ? 'Exterior' : '—')}
                  {' | '}
                  {(
                    item.floor_level === 'basement'
                      ? 'Basement'
                      : item.floor_level === '1st_floor'
                        ? '1st Floor'
                        : item.floor_level === '2nd_floor'
                          ? '2nd Floor'
                          : item.floor_level === '3rd_floor'
                            ? '3rd Floor'
                            : '—'
                  )}
                </Text>
                <View style={styles.ticketMeta}>
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
                  <Text
                    style={[
                      styles.ticketStatus,
                      item.status === 'open' && styles.ticketStatusOpen,
                      item.status === 'completed' && styles.ticketStatusCompleted,
                    ]}
                  >
                    {item.status ?? 'open'}
                  </Text>
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
    backgroundColor: '#3b3b3b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
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
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#4a4a4a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5a5a5a',
  },
  filterChipActive: {
    borderColor: '#f2681c',
    backgroundColor: '#554236',
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#ccc',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#3b3b3b',
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
    borderBottomColor: '#4a4a4a',
  },
  pickerScroll: {
    maxHeight: 320,
  },
  pickerRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#4a4a4a',
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
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  ticketThumb: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#3b3b3b',
  },
  ticketThumbWrap: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  ticketThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#3b3b3b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketBody: {
    flex: 1,
    marginLeft: 12,
  },
  ticketUnit: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
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
    backgroundColor: '#4a4a4a',
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
    backgroundColor: '#3b3b3b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4a4a',
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
