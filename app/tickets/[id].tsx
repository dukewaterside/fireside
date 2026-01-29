import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
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
import { TicketPhoto } from '../../components/TicketPhoto';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_PHOTO_HEIGHT = 280;
const ZOOM_MODAL_PHOTO_HEIGHT = 400;

type TicketDetail = {
  id: string;
  unit_id: string;
  created_by: string;
  photo_url: string | null;
  photo_urls: string[] | null;
  building_element: string;
  priority: string | null;
  notes: string | null;
  status: string | null;
  completion_notes: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  units: { unit_number: string } | null;
};

type CreatorProfile = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type AssignedContact = { user_id: string; first_name: string | null; last_name: string | null; email: string | null };

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [assigned, setAssigned] = useState<AssignedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [zoomPhotoUri, setZoomPhotoUri] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const fetchTicket = useCallback(async () => {
    if (!id) return;
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Sign in to view this ticket.');
      setTicket(null);
      setCreator(null);
      setAssigned([]);
      return;
    }
    const { data: ticketData, error: fetchErr } = await supabase
      .from('tickets')
      .select('id, unit_id, created_by, photo_url, photo_urls, building_element, priority, notes, status, completion_notes, completed_by, completed_at, created_at, updated_at, units(unit_number)')
      .eq('id', id)
      .single();

    if (fetchErr) {
      setError(fetchErr.message || 'Could not load ticket.');
      setTicket(null);
      setCreator(null);
      setAssigned([]);
      return;
    }
    const t = ticketData as TicketDetail;
    setTicket(t);

    const [{ data: creatorData }, { data: assignData }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email').eq('id', t.created_by).maybeSingle(),
      supabase.from('ticket_assignments').select('user_id, profiles(first_name, last_name, email)').eq('ticket_id', id),
    ]);
    setCreator((creatorData as CreatorProfile) ?? null);
    const assignList = (assignData ?? []) as { user_id: string; profiles: { first_name: string | null; last_name: string | null; email: string | null } | null }[];
    setAssigned(assignList.map((a) => ({ user_id: a.user_id, ...(a.profiles ?? { first_name: null, last_name: null, email: null }) })));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        await fetchTicket();
        if (mounted) setLoading(false);
      })();
      return () => { mounted = false; };
    }, [fetchTicket])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTicket();
    setRefreshing(false);
  }, [fetchTicket]);

  const handleResolve = useCallback(async () => {
    if (!ticket || ticket.status === 'completed') return;
    setResolving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setResolving(false);
      return;
    }
    const { error: updateErr } = await supabase
      .from('tickets')
      .update({
        status: 'completed',
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (updateErr) {
      setError(updateErr.message || 'Could not resolve ticket.');
      setResolving(false);
      return;
    }
    await fetchTicket();
    setResolving(false);
  }, [ticket, fetchTicket]);

  const photoUrls = ticket
    ? (ticket.photo_urls && ticket.photo_urls.length > 0 ? ticket.photo_urls : ticket.photo_url ? [ticket.photo_url] : [])
    : [];
  const primaryPhotoUrl = photoUrls[0] ?? null;

  if (!fontsLoaded) return null;
  if (!id) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ticket</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing ticket ID.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ticket</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f2681c" />
        </View>
      ) : error || !ticket ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color="#f2681c" />
          <Text style={styles.emptyTitle}>{error ?? 'Ticket not found'}</Text>
          {error === 'Sign in to view this ticket.' ? (
            <TouchableOpacity style={styles.backBtn} onPress={navigateToSignIn}>
              <Text style={styles.backBtnText}>Sign in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
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
          {/* Full-size hero photo with tap-to-zoom */}
          <View style={styles.heroPhotoWrap}>
            {primaryPhotoUrl ? (
              <TouchableOpacity
                style={styles.heroPhotoTouch}
                onPress={() => setZoomPhotoUri(primaryPhotoUrl)}
                activeOpacity={1}
              >
                <TicketPhoto
                  uri={primaryPhotoUrl}
                  style={styles.heroPhoto}
                  placeholderStyle={styles.heroPhotoPlaceholder}
                  resizeMode="cover"
                />
                <View style={styles.zoomHint}>
                  <Ionicons name="expand-outline" size={20} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.zoomHintText}>Tap to zoom</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.heroPhotoPlaceholder}>
                <Ionicons name="image-outline" size={48} color="#666" />
                <Text style={styles.heroPhotoPlaceholderText}>No photo</Text>
              </View>
            )}
            {photoUrls.length > 1 && (
              <ScrollView
                horizontal
                style={styles.thumbsScroll}
                contentContainerStyle={styles.thumbsContent}
                showsHorizontalScrollIndicator={false}
              >
                {photoUrls.map((url, index) => (
                  <TouchableOpacity
                    key={`${url}-${index}`}
                    onPress={() => setZoomPhotoUri(url)}
                    style={styles.thumbWrap}
                  >
                    <TicketPhoto uri={url} style={styles.thumb} placeholderStyle={styles.thumbPlaceholder} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Unit & status</Text>
            <View style={styles.metaRow}>
              <Text style={styles.unitName}>
                {(ticket.units as { unit_number: string } | null)?.unit_number ?? 'Unit'}
              </Text>
              <View style={[styles.badge, ticket.priority === 'high' && styles.badgeHigh]}>
                <Text style={styles.badgeText}>
                  {PRIORITY_LABELS[ticket.priority ?? 'medium'] ?? ticket.priority}
                </Text>
              </View>
              <Text style={[styles.statusText, ticket.status === 'completed' && styles.statusCompleted]}>
                {ticket.status ?? 'open'}
              </Text>
            </View>
            <Text style={styles.label}>Building element</Text>
            <Text style={styles.value}>
              {BUILDING_LABELS[ticket.building_element] ?? ticket.building_element}
            </Text>
          </View>

          {creator && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Submitted by</Text>
              <Text style={styles.value}>
                {[creator.first_name, creator.last_name].filter(Boolean).join(' ') || creator.email || 'Unknown'}
              </Text>
              {creator.email ? (
                <Text style={styles.valueSecondary}>{creator.email}</Text>
              ) : null}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesValue}>{ticket.notes || 'No notes provided.'}</Text>
          </View>

          {assigned.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Assigned contacts</Text>
              {assigned.map((a) => (
                <View key={a.user_id} style={styles.assignedRow}>
                  <Ionicons name="person-outline" size={18} color="#999" />
                  <Text style={styles.assignedName}>
                    {[a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Unknown'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Timestamps</Text>
            <Text style={styles.label}>Created</Text>
            <Text style={styles.value}>{new Date(ticket.created_at).toLocaleString()}</Text>
            {ticket.updated_at ? (
              <>
                <Text style={styles.label}>Last updated</Text>
                <Text style={styles.value}>{new Date(ticket.updated_at).toLocaleString()}</Text>
              </>
            ) : null}
            {ticket.status === 'completed' && ticket.completed_at && (
              <>
                <Text style={styles.label}>Resolved</Text>
                <Text style={styles.value}>{new Date(ticket.completed_at).toLocaleString()}</Text>
                {ticket.completion_notes ? (
                  <>
                    <Text style={styles.label}>Completion notes</Text>
                    <Text style={styles.value}>{ticket.completion_notes}</Text>
                  </>
                ) : null}
              </>
            )}
          </View>

          {ticket.status === 'open' && (
            <TouchableOpacity
              style={[styles.resolveButton, resolving && styles.resolveButtonDisabled]}
              onPress={handleResolve}
              disabled={resolving}
            >
              {resolving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                  <Text style={styles.resolveButtonText}>Mark resolved</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Zoom modal: full-size photo with pinch zoom */}
      <Modal visible={!!zoomPhotoUri} transparent animationType="fade">
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomPhotoUri(null)}>
          <View style={styles.zoomContent} onStartShouldSetResponder={() => true}>
            <ScrollView
              style={styles.zoomScroll}
              contentContainerStyle={styles.zoomScrollContent}
              maximumZoomScale={4}
              minimumZoomScale={0.5}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              {zoomPhotoUri ? (
                <TicketPhoto
                  uri={zoomPhotoUri}
                  style={[styles.zoomPhoto, { width: SCREEN_WIDTH, minHeight: ZOOM_MODAL_PHOTO_HEIGHT }]}
                  placeholderStyle={[styles.zoomPhotoPlaceholder, { width: SCREEN_WIDTH, height: ZOOM_MODAL_PHOTO_HEIGHT }]}
                  resizeMode="contain"
                />
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomPhotoUri(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Pressable>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#f2681c',
    marginBottom: 12,
  },
  backBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f2681c',
    borderRadius: 8,
  },
  backBtnText: {
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
  heroPhotoWrap: {
    marginBottom: 16,
  },
  heroPhotoTouch: {
    width: '100%',
    height: HERO_PHOTO_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#4a4a4a',
  },
  heroPhoto: {
    width: '100%',
    height: HERO_PHOTO_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#4a4a4a',
  },
  heroPhotoPlaceholder: {
    width: '100%',
    height: HERO_PHOTO_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#4a4a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPhotoPlaceholderText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 8,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  zoomHintText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.9)',
  },
  thumbsScroll: {
    marginTop: 8,
    maxHeight: 72,
  },
  thumbsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#4a4a4a',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
  },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  unitName: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  statusCompleted: {
    color: '#6a6',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#999',
    marginTop: 10,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  valueSecondary: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 2,
  },
  notesValue: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    lineHeight: 24,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  assignedName: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f2681c',
    borderRadius: 8,
    paddingVertical: 14,
  },
  resolveButtonDisabled: {
    opacity: 0.7,
  },
  resolveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
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
    minHeight: ZOOM_MODAL_PHOTO_HEIGHT,
    backgroundColor: '#333',
  },
  zoomPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
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
