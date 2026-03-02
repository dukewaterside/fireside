import React, { useState, useCallback, useEffect } from 'react';
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
  Alert,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { BUILDING_LABELS, PRIORITY_LABELS } from '../../lib/constants/tickets';
import { getSignedTicketPhotoUrl } from '../../lib/services/tickets';
import { TicketPhoto } from '../../components/TicketPhoto';
import { formatPhoneNumberDisplay } from '../../lib/utils/phone';

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
  building_elements: string[] | null;
  location_scope: 'interior' | 'exterior' | null;
  floor_level: 'basement' | '1st_floor' | '2nd_floor' | '3rd_floor' | null;
  priority: string | null;
  notes: string | null;
  status: string | null;
  completion_notes: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  units: { unit_number: string } | { unit_number: string }[] | null;
};

type CreatorProfile = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type AssignedContact = {
  key: string;
  user_id?: string | null;
  contact_id?: string | null;
  profile_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name?: string | null;
  email: string | null;
  phone?: string | null;
};
type ContactOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

function formatTicketDateTime(value: string): string {
  const d = new Date(value);
  const datePart = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

function displayContactName(contact: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Unknown';
}

function normalizePhoneForDial(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

export default function TicketDetailScreen() {
  const { id, demoBoard } = useLocalSearchParams<{ id: string; demoBoard?: string }>();
  const showDemoBoardGuide = demoBoard === '1';
  const [demoDetailStep, setDemoDetailStep] = useState<'tagged' | 'message_board' | 'done'>(
    showDemoBoardGuide ? 'tagged' : 'done'
  );
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [assigned, setAssigned] = useState<AssignedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [zoomPhotoUri, setZoomPhotoUri] = useState<string | null>(null);
  const [zoomPhotoSignedUri, setZoomPhotoSignedUri] = useState<string | null>(null);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [taggedModalVisible, setTaggedModalVisible] = useState(false);
  const [addContactModalVisible, setAddContactModalVisible] = useState(false);
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);
  const [canResolveTicket, setCanResolveTicket] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

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
      .select('id, unit_id, created_by, photo_url, photo_urls, building_element, building_elements, location_scope, floor_level, priority, notes, status, completion_notes, completed_by, completed_at, created_at, updated_at, units(unit_number)')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      setError(fetchErr.message || 'Could not load ticket.');
      setTicket(null);
      setCreator(null);
      setAssigned([]);
      return;
    }
    if (!ticketData) {
      setError('Ticket not found or you do not have access.');
      setTicket(null);
      setCreator(null);
      setAssigned([]);
      return;
    }
    const tRaw = ticketData as TicketDetail;
    const unitObj = Array.isArray(tRaw.units) ? (tRaw.units[0] ?? null) : tRaw.units;
    const t = { ...tRaw, units: unitObj };
    setTicket(t);

    const [{ data: creatorData }, { data: assignData }, { data: contactAssignData }, { count: cCount }, { data: currentProfile }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email').eq('id', t.created_by).maybeSingle(),
      supabase.from('ticket_assignments').select('user_id, profiles(first_name, last_name, email, phone)').eq('ticket_id', id),
      supabase
        .from('ticket_contact_assignments')
        .select('contact_id, contacts(profile_id, company_name, first_name, last_name, email, phone)')
        .eq('ticket_id', id),
      supabase.from('ticket_comments').select('*', { count: 'exact', head: true }).eq('ticket_id', id),
      supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle(),
    ]);
    setCreator((creatorData as CreatorProfile) ?? null);
    const assignList = (assignData ?? []) as {
      user_id: string;
      profiles:
        | { first_name: string | null; last_name: string | null; email: string | null; phone: string | null }
        | { first_name: string | null; last_name: string | null; email: string | null; phone: string | null }[]
        | null;
    }[];
    const assignedFromProfiles: AssignedContact[] = assignList.map((a) => {
      const profileObj = Array.isArray(a.profiles) ? (a.profiles[0] ?? null) : a.profiles;
      return {
        key: `user:${a.user_id}`,
        user_id: a.user_id,
        profile_id: a.user_id,
        ...(profileObj ?? { first_name: null, last_name: null, email: null }),
        phone: profileObj?.phone ?? null,
      };
    });

    const assignedProfileIds = new Set(assignedFromProfiles.map((a) => a.profile_id).filter(Boolean));
    const contactAssignList = (contactAssignData ?? []) as {
      contact_id: string;
      contacts:
        | { profile_id: string | null; company_name: string | null; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }
        | { profile_id: string | null; company_name: string | null; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }[]
        | null;
    }[];
    const assignedFromContacts: AssignedContact[] = contactAssignList
      .map((a) => {
        const contactObj = Array.isArray(a.contacts) ? (a.contacts[0] ?? null) : a.contacts;
        return {
          key: `contact:${a.contact_id}`,
          contact_id: a.contact_id,
          profile_id: contactObj?.profile_id ?? null,
          first_name: contactObj?.first_name ?? null,
          last_name: contactObj?.last_name ?? null,
          company_name: contactObj?.company_name ?? null,
          email: contactObj?.email ?? null,
          phone: contactObj?.phone ?? null,
        };
      })
      .filter((a) => !(a.profile_id && assignedProfileIds.has(a.profile_id)));

    setAssigned([...assignedFromProfiles, ...assignedFromContacts]);
    setCommentCount(cCount ?? 0);
    const role = (currentProfile as { role?: string | null } | null)?.role ?? null;
    setCanResolveTicket(role === 'owner' || role === 'designer' || role === 'developer' || role === 'project_manager');
  }, [id]);

  const fetchContactOptions = useCallback(async () => {
    if (!ticket?.id) return;
    setLoadingContacts(true);
    const { data, error: contactsErr } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, email')
      .is('merged_into_contact_id', null)
      .eq('status', 'active')
      .order('first_name', { ascending: true });
    setLoadingContacts(false);
    if (contactsErr) return;
    setContactOptions((data as ContactOption[]) ?? []);
  }, [ticket?.id]);

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
    if (!canResolveTicket) {
      setError('Only owners, designers, developers, and project managers can resolve tickets.');
      return;
    }
    setError(null);
    setResolving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Sign in again to resolve this ticket.');
      setResolving(false);
      return;
    }
    const { data: updatedRows, error: updateErr } = await supabase
      .from('tickets')
      .update({
        status: 'completed',
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select('id');

    if (updateErr) {
      setError(updateErr.message || 'Could not resolve ticket.');
      setResolving(false);
      return;
    }
    if (!updatedRows || updatedRows.length === 0) {
      setError('You do not have permission to resolve this ticket.');
      setResolving(false);
      return;
    }
    await fetchTicket();
    setResolving(false);
  }, [ticket, fetchTicket, canResolveTicket]);

  const photoUrls = ticket
    ? (ticket.photo_urls && ticket.photo_urls.length > 0 ? ticket.photo_urls : ticket.photo_url ? [ticket.photo_url] : [])
    : [];
  const primaryPhotoUrl = photoUrls[0] ?? null;

  const callAssignedContact = useCallback((contact: AssignedContact) => {
    const raw = contact.phone?.trim();
    if (!raw) {
      Alert.alert('No phone number', `${displayContactName(contact)} does not have a phone number yet.`);
      return;
    }
    Linking.openURL(`tel:${normalizePhoneForDial(raw)}`).catch(() => {
      Alert.alert('Call failed', 'Could not open the phone dialer.');
    });
  }, []);

  const addContactToTicket = useCallback(async (contactId: string) => {
    if (!ticket?.id) return;
    setAddingContactId(contactId);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertErr } = await supabase.from('ticket_contact_assignments').insert({
      ticket_id: ticket.id,
      contact_id: contactId,
      created_by: user?.id ?? null,
    });
    setAddingContactId(null);
    if (insertErr) {
      Alert.alert('Could not add contact', insertErr.message || 'Please try again.');
      return;
    }
    await fetchTicket();
    setAddContactModalVisible(false);
    setTaggedModalVisible(true);
  }, [ticket?.id, fetchTicket]);

  const buildingElementText = (
    (ticket?.building_elements && ticket.building_elements.length > 0 ? ticket.building_elements : ticket ? [ticket.building_element] : [])
      .filter(Boolean)
      .map((v) => BUILDING_LABELS[v] ?? v)
      .join(', ')
  );

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
            <View style={styles.postHeader}>
              <View style={styles.postAuthorBlock}>
                <Text style={styles.postAuthor}>
                  {creator
                    ? ([creator.first_name, creator.last_name].filter(Boolean).join(' ') || creator.email || 'Unknown')
                    : 'Unknown'}
                </Text>
                <Text style={styles.postTimestamp}>{formatTicketDateTime(ticket.created_at)}</Text>
                {ticket.status === 'completed' && ticket.completed_at ? (
                  <Text style={styles.postTimestamp}>Resolved {formatTicketDateTime(ticket.completed_at)}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.unitName}>
                {(ticket.units as { unit_number: string } | null)?.unit_number ?? 'Unit'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.badge,
                  ticket.priority === 'high' && styles.badgeHigh,
                  ticket.priority === 'medium' && styles.badgeMedium,
                ]}
              >
                <Text style={styles.badgeText}>
                  {PRIORITY_LABELS[ticket.priority ?? 'medium'] ?? ticket.priority}
                </Text>
              </View>
              <Text
                style={[
                  styles.statusText,
                  ticket.status === 'open' && styles.statusOpen,
                  ticket.status === 'completed' && styles.statusCompleted,
                ]}
              >
                {ticket.status ?? 'open'}
              </Text>
            </View>

            <Text style={styles.value}>
              {buildingElementText}
            </Text>
            <View style={styles.compactChipsRow}>
              <View style={styles.compactChip}>
                <Ionicons name="home-outline" size={14} color="#bbb" />
                <Text style={styles.compactChipText}>
                  {ticket.location_scope === 'interior'
                    ? 'Interior'
                    : ticket.location_scope === 'exterior'
                      ? 'Exterior'
                      : 'Unspecified'}
                </Text>
              </View>
              <View style={styles.compactChip}>
                <Ionicons name="layers-outline" size={14} color="#bbb" />
                <Text style={styles.compactChipText}>
                  {ticket.floor_level === '1st_floor'
                    ? '1st Floor'
                    : ticket.floor_level === '2nd_floor'
                      ? '2nd Floor'
                      : ticket.floor_level === '3rd_floor'
                        ? '3rd Floor'
                        : ticket.floor_level === 'basement'
                          ? 'Basement'
                      : 'Floor n/a'}
                </Text>
              </View>
            </View>

            <Text style={styles.notesSubtitle}>Notes</Text>
            <View style={styles.notesWrap}>
              <Text style={styles.notesValue}>{ticket.notes || 'No notes provided.'}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.taggedButton,
                showDemoBoardGuide && demoDetailStep === 'tagged' && styles.demoStepHighlight,
              ]}
              onPress={() => {
                if (showDemoBoardGuide && demoDetailStep === 'tagged') {
                  setDemoDetailStep('message_board');
                }
                setTaggedModalVisible(true);
              }}
            >
              <Ionicons name="pricetags-outline" size={18} color="#fff" />
              <Text style={styles.taggedButtonText}>Tagged</Text>
              <View style={styles.messageBoardCountBadge}>
                <Text style={styles.messageBoardCountText}>{assigned.length}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.messageBoardButton,
                showDemoBoardGuide && demoDetailStep === 'message_board' && styles.demoStepHighlight,
              ]}
              onPress={() => {
                if (showDemoBoardGuide && demoDetailStep === 'tagged') {
                  Alert.alert('Try Tagged first', 'Open Tagged first. It shows who is assigned and who gets notified.');
                  return;
                }
                setDemoDetailStep('done');
                router.push({ pathname: '/tickets/[id]/comments', params: { id: ticket.id } });
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
              <Text style={styles.messageBoardButtonText}>Message Board</Text>
              <View style={styles.messageBoardCountBadge}>
                <Text style={styles.messageBoardCountText}>{commentCount}</Text>
              </View>
            </TouchableOpacity>
            {showDemoBoardGuide ? (
              <View style={styles.demoBoardGuide}>
                <Text style={styles.demoBoardGuideText}>
                  {demoDetailStep === 'tagged'
                    ? 'Start with Tagged. Tagged contacts are assigned to this ticket and get notified about updates.'
                    : demoDetailStep === 'message_board'
                      ? 'Great. Now open Message Board. It is a live conversation thread for this ticket.'
                      : 'Nice work. You are ready to use this ticket flow.'}
                </Text>
              </View>
            ) : null}

            {ticket.status === 'open' && canResolveTicket && (
              <TouchableOpacity
                style={[styles.resolveButton, resolving && styles.resolveButtonDisabled]}
                onPress={handleResolve}
                disabled={resolving}
              >
                {resolving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.resolveButtonText}>Mark resolved</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {ticket.completion_notes ? (
              <View style={styles.completionCard}>
                <Text style={styles.completionText}>{ticket.completion_notes}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {/* Zoom modal: full-size photo with pinch zoom + pan */}
      <Modal visible={!!zoomPhotoUri} transparent animationType="fade">
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomPhotoUri(null)}>
          <View style={styles.zoomContent} onStartShouldSetResponder={() => true}>
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
                <View style={[styles.zoomPhotoPlaceholder, { width: SCREEN_WIDTH, height: ZOOM_MODAL_PHOTO_HEIGHT }]}>
                  <ActivityIndicator size="large" color="#f2681c" />
                </View>
              ) : zoomPhotoSignedUri ? (
                <Image
                  source={{ uri: zoomPhotoSignedUri }}
                  style={[styles.zoomPhoto, { width: SCREEN_WIDTH, minHeight: ZOOM_MODAL_PHOTO_HEIGHT }]}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.zoomPhotoPlaceholder, { width: SCREEN_WIDTH, height: ZOOM_MODAL_PHOTO_HEIGHT }]}>
                  <Ionicons name="image-outline" size={42} color="#666" />
                </View>
              )}
            </ScrollView>
            <Text style={styles.zoomHelperText}>Pinch to zoom • Drag to pan</Text>
            <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomPhotoUri(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={taggedModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setTaggedModalVisible(false)}>
          <TouchableOpacity style={styles.pickerModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Tagged contacts</Text>
            <ScrollView style={styles.pickerScroll}>
              {assigned.length === 0 ? (
                <Text style={styles.emptyPickerText}>No tagged contacts yet.</Text>
              ) : (
                assigned.map((a) => (
                  <TouchableOpacity key={a.key} style={styles.pickerRow} onPress={() => callAssignedContact(a)}>
                    <Text style={styles.pickerRowText}>{displayContactName(a)}</Text>
                    <Text style={styles.pickerRowSubText}>
                      {a.phone?.trim() ? formatPhoneNumberDisplay(a.phone) : 'No phone number'}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => {
                setTaggedModalVisible(false);
                setAddContactModalVisible(true);
                fetchContactOptions();
              }}
            >
              <Text style={styles.pickerCloseText}>Add contact</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerCloseSecondary} onPress={() => setTaggedModalVisible(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={addContactModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setAddContactModalVisible(false)}>
          <TouchableOpacity style={styles.pickerModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Add contact to ticket</Text>
            {loadingContacts ? (
              <View style={styles.pickerLoadingWrap}>
                <ActivityIndicator color="#f2681c" />
              </View>
            ) : (
              <ScrollView style={styles.pickerScroll}>
                {contactOptions
                  .filter((c) => !assigned.some((a) => a.contact_id === c.id))
                  .map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.pickerRow}
                      onPress={() => addContactToTicket(c.id)}
                      disabled={addingContactId === c.id}
                    >
                      <Text style={styles.pickerRowText}>{displayContactName(c)}</Text>
                      <Text style={styles.pickerRowSubText}>
                        {c.phone?.trim() ? formatPhoneNumberDisplay(c.phone) : c.email || 'No contact info'}
                      </Text>
                      {addingContactId === c.id ? <ActivityIndicator size="small" color="#f2681c" /> : null}
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.pickerCloseSecondary} onPress={() => setAddContactModalVisible(false)}>
              <Text style={styles.pickerCloseText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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
  postHeader: {
    marginBottom: 10,
  },
  postAuthorBlock: {
    gap: 2,
  },
  postAuthor: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  postTimestamp: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#aaa',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  compactChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#555',
  },
  compactChipText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#ddd',
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
  badgeMedium: {
    backgroundColor: '#8a6a1f',
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
  statusOpen: {
    color: '#6fcf7a',
  },
  statusCompleted: {
    color: '#9aa3af',
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
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    lineHeight: 22,
  },
  notesSubtitle: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#9ca3af',
  },
  notesWrap: {
    borderLeftWidth: 2,
    borderLeftColor: '#666',
    paddingLeft: 10,
  },
  completionCard: {
    marginTop: 10,
    backgroundColor: '#4f5c4f',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  completionText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#d8ead8',
    lineHeight: 20,
  },
  taggedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5a5a5a',
    borderRadius: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  taggedButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  messageBoardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5a5a5a',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  messageBoardButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  messageBoardCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f2681c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  messageBoardCountText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  demoBoardGuide: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f2681c',
    backgroundColor: '#4a4a4a',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  demoBoardGuideText: {
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
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
    paddingVertical: 10,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  resolveButtonDisabled: {
    opacity: 0.7,
  },
  resolveButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  demoStepHighlight: {
    borderWidth: 1.5,
    borderColor: '#f2681c',
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
  pickerRowSubText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#aaa',
    marginTop: 4,
  },
  emptyPickerText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  pickerClose: {
    marginTop: 16,
    marginHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f2681c',
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerCloseSecondary: {
    marginTop: 10,
    marginHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#5a5a5a',
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  pickerLoadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
