import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
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

type TicketRow = {
  id: string;
  unit_id: string;
  created_by: string;
  photo_url: string | null;
  building_element: string;
  priority: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
  units: { unit_number: string } | null;
};

export default function TicketsScreen() {
  const params = useLocalSearchParams<{ unitId?: string }>();
  const unitId = params.unitId ?? '';

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

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
      .select('id, unit_id, created_by, photo_url, building_element, priority, notes, status, created_at, units(unit_number)')
      .order('created_at', { ascending: false });
    if (unitId) query = query.eq('unit_id', unitId);
    let { data, error } = await query;

    if (error) {
      let fallback = supabase
        .from('tickets')
        .select('id, unit_id, created_by, photo_url, building_element, priority, notes, status, created_at')
        .order('created_at', { ascending: false });
      if (unitId) fallback = fallback.eq('unit_id', unitId);
      const { data: dataNoJoin, error: errorNoJoin } = await fallback;
      if (!errorNoJoin && dataNoJoin?.length) {
        setTickets((dataNoJoin as TicketRow[]).map((t) => ({ ...t, units: null })));
        return;
      }
      setFetchError(error.message || 'Could not load tickets.');
      setTickets([]);
      return;
    }
    setTickets((data as TicketRow[]) ?? []);
  }, [unitId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        await fetchTickets();
        if (mounted) setLoading(false);
      })();
      return () => { mounted = false; };
    }, [fetchTickets])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }, [fetchTickets]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tickets</Text>
        <View style={styles.headerRight} />
      </View>

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
      ) : tickets.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="ticket-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>No tickets yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a ticket from the home screen by selecting a unit and tapping "Create a ticket".
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
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f2681c"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.ticketCard}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: item.id } })}
            >
              {item.photo_url ? (
                <TicketPhoto uri={item.photo_url} style={styles.ticketThumb} resizeMode="cover" />
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
                  {BUILDING_LABELS[item.building_element] ?? item.building_element}
                </Text>
                <View style={styles.ticketMeta}>
                  <View style={[styles.badge, item.priority === 'high' && styles.badgeHigh]}>
                    <Text style={styles.badgeText}>
                      {PRIORITY_LABELS[item.priority ?? 'medium'] ?? item.priority}
                    </Text>
                  </View>
                  <Text style={styles.ticketStatus}>{item.status ?? 'open'}</Text>
                  <Text style={styles.ticketDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          )}
        />
      )}
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
  ticketDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginLeft: 'auto',
  },
});
