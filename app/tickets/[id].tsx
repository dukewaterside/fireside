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
const HERO_PHOTO_HEIGHT = 260;
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
  title: string | null;
  status: string | null;
  due_date: string | null;
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
  const [statusModalVisible, setStatusModalVisible] = useState(false);
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
  const [menuVisible, setMenuVisible] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFontTimeout(true), 5000); return () => clearTimeout(t); }, []);

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
      .select('id, unit_id, created_by, title, photo_url, photo_urls, building_element, building_elements, location_scope, floor_level, priority, notes, status, due_date, completion_notes, completed_by, completed_at, created_at, updated_at, units(unit_number)')
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

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!ticket) return;
    if (!canResolveTicket) {
      setError('Only owners, designers, developers, and project managers can change ticket status.');
      return;
    }
    setError(null);
    setResolving(true);
    setStatusModalVisible(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Sign in again to change ticket status.');
      setResolving(false);
      return;
    }
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'completed') {
      updatePayload.completed_by = user.id;
      updatePayload.completed_at = new Date().toISOString();
    } else {
      updatePayload.completed_by = null;
      updatePayload.completed_at = null;
    }
    const { data: updatedRows, error: updateErr } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticket.id)
      .select('id');

    if (updateErr) {
      setError(updateErr.message || 'Could not update ticket status.');
      setResolving(false);
      return;
    }
    if (!updatedRows || updatedRows.length === 0) {
      setError('You do not have permission to change this ticket.');
      setResolving(false);
      return;
    }
    await fetchTicket();
    setResolving(false);
  }, [ticket, fetchTicket, canResolveTicket]);

  const handleDelete = useCallback(() => {
    if (!ticket) return;
    Alert.alert('Delete ticket', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error: delErr } = await supabase.from('tickets').delete().eq('id', ticket.id);
          if (delErr) { Alert.alert('Error', delErr.message); return; }
          router.replace('/tickets');
        },
      },
    ]);
  }, [ticket]);

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

  const buildingElements = (
    (ticket?.building_elements && ticket.building_elements.length > 0 ? ticket.building_elements : ticket ? [ticket.building_element] : [])
      .filter(Boolean)
  );

  // Title: use ticket.title if set, otherwise fall back to building elements + unit name
  const ticketTitle = ticket?.title
    || buildingElements.map((v) => BUILDING_LABELS[v] ?? v).join(', ')
    || (ticket?.units as { unit_number: string } | null)?.unit_number
    || 'Ticket';

  const floorLabel = ticket?.floor_level === '1st_floor' ? '1st Floor'
    : ticket?.floor_level === '2nd_floor' ? '2nd Floor'
    : ticket?.floor_level === '3rd_floor' ? '3rd Floor'
    : ticket?.floor_level === 'basement' ? 'Basement' : null;
  const locationLabel = ticket?.location_scope === 'interior' ? 'Interior'
    : ticket?.location_scope === 'exterior' ? 'Exterior' : null;
  const tagChips = [
    ...buildingElements.map((v) => ({ label: BUILDING_LABELS[v] ?? v, prefix: '+ ' })),
    ...(locationLabel ? [{ label: locationLabel, prefix: '' }] : []),
    ...(floorLabel ? [{ label: floorLabel, prefix: '' }] : []),
  ];

  const creatorName = creator ? ([creator.first_name, creator.last_name].filter(Boolean).join(' ') || creator.email || 'Unknown') : 'Unknown';
  const getInitials = (name: string) => name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);

  const statusText = ticket?.status === 'in_progress' ? 'In Progress' : ticket?.status === 'completed' ? 'Resolved' : 'Open';
  const sColor = ticket?.status === 'in_progress' ? '#facc15' : ticket?.status === 'completed' ? '#9aa3af' : '#6fcf7a';
  const priorityText = PRIORITY_LABELS[ticket?.priority ?? 'medium'] ?? 'Medium';
  const pColor = ticket?.priority === 'high' ? '#f87171' : ticket?.priority === 'medium' ? '#d4a017' : '#6fcf7a';

  const unitName = (ticket?.units as { unit_number: string } | null)?.unit_number ?? 'Unit';

  if (!fontsLoaded && !fontTimeout) return null;
  if (!id) {
    return (
      <SafeAreaView style={st.container} edges={['top', 'bottom']}>
        <View style={st.header}>
          <TouchableOpacity style={st.headerSide} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#f2681c" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Ticket</Text>
          <View style={st.headerSide} />
        </View>
        <View style={st.centered}>
          <Text style={{ color: '#f2681c', fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 12 }}>Missing ticket ID.</Text>
          <TouchableOpacity style={st.orangeBtn} onPress={() => router.back()}>
            <Text style={st.orangeBtnLabel}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.container} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={st.header}>
        <TouchableOpacity style={st.headerSide} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#f2681c" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Ticket</Text>
        <TouchableOpacity style={st.headerSide} onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#999" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={st.centered}><ActivityIndicator size="large" color="#f2681c" /></View>
      ) : error || !ticket ? (
        <View style={st.centered}>
          <Ionicons name="alert-circle-outline" size={64} color="#f2681c" />
          <Text style={st.emptyTitle}>{error ?? 'Ticket not found'}</Text>
          <TouchableOpacity style={st.orangeBtn} onPress={error === 'Sign in to view this ticket.' ? navigateToSignIn : () => router.back()}>
            <Text style={st.orangeBtnLabel}>{error === 'Sign in to view this ticket.' ? 'Sign in' : 'Back'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2681c" />} showsVerticalScrollIndicator={false}>

          {/* ── Status bar ── */}
          <View style={[st.statusBar, { backgroundColor: sColor + '18' }]}>
            <View style={st.statusLeft}>
              <View style={[st.statusDot, { backgroundColor: sColor }]} />
              <Text style={[st.statusText, { color: sColor }]}>{statusText}</Text>
            </View>
            <Text style={st.priorityText}>{priorityText} priority</Text>
          </View>

          {/* ── Hero photo ── */}
          <View style={st.heroWrap}>
            <TouchableOpacity activeOpacity={0.95} onPress={() => primaryPhotoUrl && setZoomPhotoUri(primaryPhotoUrl)} style={st.heroTouch}>
              {primaryPhotoUrl ? (
                <>
                  <TicketPhoto uri={primaryPhotoUrl} style={st.heroImg} placeholderStyle={st.heroPlaceholder} resizeMode="cover" />
                  <View style={st.photoBadge}>
                    <Text style={st.photoBadgeText}>{photoUrls.indexOf(zoomPhotoUri ?? '') >= 0 ? photoUrls.indexOf(zoomPhotoUri!) + 1 : 1} of {photoUrls.length}</Text>
                  </View>
                </>
              ) : (
                <View style={st.heroPlaceholder}><Ionicons name="image-outline" size={44} color="#555" /></View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Title + unit ── */}
          <View style={st.titleSection}>
            <Text style={st.ticketTitle}>{ticketTitle}</Text>
            <Text style={st.unitLabel}>{unitName}</Text>
          </View>

          {/* ── Tag chips ── */}
          {tagChips.length > 0 && (
            <View style={st.chipRow}>
              {tagChips.map((chip, i) => (
                <View key={`${chip.label}-${i}`} style={st.chip}>
                  <Text style={st.chipText}>{chip.prefix}{chip.label}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={st.divider} />

          {/* ── Notes ── */}
          <View style={st.section}>
            <Text style={st.sectionLabel}>NOTES</Text>
            <Text style={st.notesBody}>{ticket.notes || 'No notes provided.'}</Text>
          </View>

          {ticket.completion_notes ? (
            <View style={st.completionCard}>
              <Text style={st.completionText}>{ticket.completion_notes}</Text>
            </View>
          ) : null}

          <View style={st.divider} />

          {/* ── Details ── */}
          <View style={st.section}>
            <Text style={st.sectionLabel}>DETAILS</Text>

            <View style={st.detailRow}>
              <Text style={st.detailLabel}>Reported by</Text>
              <View style={st.detailRight}>
                <View style={st.avatarOrange}>
                  <Text style={st.avatarOrangeText}>{getInitials(creatorName)}</Text>
                </View>
                <Text style={st.detailValue}>{creatorName}</Text>
              </View>
            </View>

            <View style={st.detailRow}>
              <Text style={st.detailLabel}>Date</Text>
              <Text style={st.detailValue}>{formatTicketDateTime(ticket.created_at)}</Text>
            </View>

            {ticket.due_date ? (
              <View style={st.detailRow}>
                <Text style={st.detailLabel}>Due date</Text>
                <Text style={[st.detailValue, new Date(ticket.due_date) < new Date() && ticket.status !== 'completed' && { color: '#f87171' }]}>
                  {new Date(ticket.due_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {new Date(ticket.due_date) < new Date() && ticket.status !== 'completed' ? '  (overdue)' : ''}
                </Text>
              </View>
            ) : null}

            {ticket.status === 'completed' && ticket.completed_at ? (
              <View style={st.detailRow}>
                <Text style={st.detailLabel}>Resolved</Text>
                <Text style={st.detailValue}>{formatTicketDateTime(ticket.completed_at)}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[st.detailRow, showDemoBoardGuide && demoDetailStep === 'tagged' && st.highlight]}
              onPress={() => {
                if (showDemoBoardGuide && demoDetailStep === 'tagged') setDemoDetailStep('message_board');
                setTaggedModalVisible(true);
              }}
            >
              <Text style={st.detailLabel}>Tagged</Text>
              <View style={st.detailRight}>
                {assigned.slice(0, 3).map((a, i) => {
                  const initials = getInitials(displayContactName(a));
                  return (
                    <View key={a.key} style={[st.avatarMini, i > 0 && { marginLeft: -6 }]}>
                      <Text style={st.avatarMiniText}>{initials}</Text>
                    </View>
                  );
                })}
                <Text style={st.detailLink}>
                  {assigned.length === 0 ? 'Add' : `${assigned.length} ${assigned.length === 1 ? 'person' : 'people'}`}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[st.detailRow, st.detailRowLast, showDemoBoardGuide && demoDetailStep === 'message_board' && st.highlight]}
              onPress={() => {
                if (showDemoBoardGuide && demoDetailStep === 'tagged') { Alert.alert('Try Tagged first', 'Open Tagged first.'); return; }
                setDemoDetailStep('done');
                router.push({ pathname: '/tickets/[id]/comments', params: { id: ticket.id } });
              }}
            >
              <Text style={st.detailLabel}>Messages</Text>
              <Text style={st.detailValue}>{commentCount}</Text>
            </TouchableOpacity>
          </View>

          {showDemoBoardGuide ? (
            <View style={st.demoGuide}>
              <Text style={st.demoGuideText}>
                {demoDetailStep === 'tagged' ? 'Start with Tagged. Tagged contacts are assigned and get notified.'
                  : demoDetailStep === 'message_board' ? 'Great. Now open Message Board for live conversation.'
                  : 'Nice work. You are ready to use this ticket flow.'}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* ── Bottom action bar ── */}
        <View style={st.bottomBar}>
          <TouchableOpacity style={st.btnOutline} onPress={() => {
            if (showDemoBoardGuide && demoDetailStep === 'tagged') { Alert.alert('Try Tagged first', 'Open Tagged first.'); return; }
            setDemoDetailStep('done');
            router.push({ pathname: '/tickets/[id]/comments', params: { id: ticket.id } });
          }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={st.btnOutlineText}>Comment</Text>
          </TouchableOpacity>
          {canResolveTicket ? (
            <TouchableOpacity style={[st.btnOrange, resolving && { opacity: 0.6 }]} onPress={() => setStatusModalVisible(true)} disabled={resolving}>
              {resolving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="swap-horizontal-outline" size={17} color="#fff" />
                  <Text style={st.btnOrangeText}>Change Status</Text>
                </>
              )}
            </TouchableOpacity>
          ) : <View style={{ flex: 1.2 }} />}
        </View>
        </>
      )}

      {/* ─── Zoom modal ─── */}
      <Modal visible={!!zoomPhotoUri} transparent animationType="fade">
        <Pressable style={st.zoomBg} onPress={() => setZoomPhotoUri(null)}>
          <View style={st.zoomWrap} onStartShouldSetResponder={() => true}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={st.zoomInner} maximumZoomScale={6} minimumZoomScale={1} bouncesZoom centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
              {zoomLoading ? (
                <View style={[st.zoomPlaceholder, { width: SCREEN_WIDTH, height: ZOOM_MODAL_PHOTO_HEIGHT }]}><ActivityIndicator size="large" color="#f2681c" /></View>
              ) : zoomPhotoSignedUri ? (
                <Image source={{ uri: zoomPhotoSignedUri }} style={{ width: SCREEN_WIDTH, minHeight: ZOOM_MODAL_PHOTO_HEIGHT, backgroundColor: '#222' }} resizeMode="contain" />
              ) : (
                <View style={[st.zoomPlaceholder, { width: SCREEN_WIDTH, height: ZOOM_MODAL_PHOTO_HEIGHT }]}><Ionicons name="image-outline" size={42} color="#666" /></View>
              )}
            </ScrollView>
            <Text style={st.zoomHint}>Pinch to zoom · Drag to pan</Text>
            <TouchableOpacity style={st.zoomClose} onPress={() => setZoomPhotoUri(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Menu modal (delete) ─── */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={st.menuBg} onPress={() => setMenuVisible(false)}>
          <View style={st.menuCard}>
            <TouchableOpacity style={st.menuRow} onPress={() => { setMenuVisible(false); handleDelete(); }}>
              <Ionicons name="trash-outline" size={20} color="#f87171" />
              <Text style={st.menuRowTextDanger}>Delete ticket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.menuRow, st.menuRowLast]} onPress={() => setMenuVisible(false)}>
              <Ionicons name="close-outline" size={20} color="#999" />
              <Text style={st.menuRowText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Tagged modal ─── */}
      <Modal visible={taggedModalVisible} transparent animationType="slide">
        <TouchableOpacity style={st.modalBg} activeOpacity={1} onPress={() => setTaggedModalVisible(false)}>
          <TouchableOpacity style={st.sheet} activeOpacity={1} onPress={() => {}}>
            <Text style={st.sheetTitle}>Tagged contacts</Text>
            <ScrollView style={st.sheetScroll}>
              {assigned.length === 0 ? (
                <Text style={st.sheetEmpty}>No tagged contacts yet.</Text>
              ) : assigned.map((a) => (
                <TouchableOpacity key={a.key} style={st.sheetRow} onPress={() => callAssignedContact(a)}>
                  <Text style={st.sheetRowText}>{displayContactName(a)}</Text>
                  <Text style={st.sheetRowSub}>{a.phone?.trim() ? formatPhoneNumberDisplay(a.phone) : 'No phone number'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={st.sheetBtnPrimary} onPress={() => { setTaggedModalVisible(false); setAddContactModalVisible(true); fetchContactOptions(); }}>
              <Text style={st.sheetBtnText}>Add contact</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.sheetBtnSecondary} onPress={() => setTaggedModalVisible(false)}>
              <Text style={st.sheetBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── Status modal ─── */}
      <Modal visible={statusModalVisible} transparent animationType="slide">
        <TouchableOpacity style={st.modalBg} activeOpacity={1} onPress={() => setStatusModalVisible(false)}>
          <TouchableOpacity style={st.sheet} activeOpacity={1} onPress={() => {}}>
            <Text style={st.sheetTitle}>Update status</Text>
            <ScrollView style={st.sheetScroll}>
              {([
                { value: 'open', label: 'Open', icon: 'radio-button-off-outline' as const, color: '#6fcf7a' },
                { value: 'in_progress', label: 'In Progress', icon: 'time-outline' as const, color: '#facc15' },
                { value: 'completed', label: 'Resolved', icon: 'checkmark-circle-outline' as const, color: '#9aa3af' },
              ]).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[st.sheetRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, ticket?.status === opt.value && { backgroundColor: '#444' }]}
                  onPress={() => handleStatusChange(opt.value)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name={opt.icon} size={20} color={opt.color} />
                    <Text style={st.sheetRowText}>{opt.label}</Text>
                  </View>
                  {ticket?.status === opt.value && <Ionicons name="checkmark" size={20} color="#f2681c" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={st.sheetBtnSecondary} onPress={() => setStatusModalVisible(false)}>
              <Text style={st.sheetBtnText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── Add contact modal ─── */}
      <Modal visible={addContactModalVisible} transparent animationType="slide">
        <TouchableOpacity style={st.modalBg} activeOpacity={1} onPress={() => setAddContactModalVisible(false)}>
          <TouchableOpacity style={st.sheet} activeOpacity={1} onPress={() => {}}>
            <Text style={st.sheetTitle}>Add contact to ticket</Text>
            {loadingContacts ? (
              <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator color="#f2681c" /></View>
            ) : (
              <ScrollView style={st.sheetScroll}>
                {contactOptions.filter((c) => !assigned.some((a) => a.contact_id === c.id)).map((c) => (
                  <TouchableOpacity key={c.id} style={st.sheetRow} onPress={() => addContactToTicket(c.id)} disabled={addingContactId === c.id}>
                    <Text style={st.sheetRowText}>{displayContactName(c)}</Text>
                    <Text style={st.sheetRowSub}>{c.phone?.trim() ? formatPhoneNumberDisplay(c.phone) : c.email || 'No contact info'}</Text>
                    {addingContactId === c.id ? <ActivityIndicator size="small" color="#f2681c" /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={st.sheetBtnSecondary} onPress={() => setAddContactModalVisible(false)}>
              <Text style={st.sheetBtnText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */

const st = StyleSheet.create({
  // ── Layout ──
  container:     { flex: 1, backgroundColor: '#2e2e2e' },
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  centered:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  // ── Header ──
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#2e2e2e' },
  headerSide:  { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // ── Error / empty ──
  emptyTitle:   { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: '#fff', marginTop: 16, textAlign: 'center' },
  orangeBtn:    { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#f2681c', borderRadius: 8 },
  orangeBtnLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // ── Status bar ──
  statusBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  statusLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  statusText:   { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  priorityText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#d4a017' },

  // ── Hero image ──
  heroWrap:        { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  heroTouch:       { borderRadius: 12, overflow: 'hidden', backgroundColor: '#3a3a3a' },
  heroImg:         { width: '100%', height: 360, backgroundColor: '#3a3a3a' },
  heroPlaceholder: { width: '100%', height: 360, backgroundColor: '#3a3a3a', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  photoBadge:      { position: 'absolute', bottom: 10, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  photoBadgeText:  { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // ── Title ──
  titleSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  ticketTitle:  { fontSize: 22, fontFamily: 'Inter_600SemiBold', color: '#fff', marginBottom: 4 },
  unitLabel:    { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#999' },

  // ── Tag chips ──
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  chip:     { borderWidth: 1, borderColor: '#f2681c', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#f2681c' },

  // ── Divider ──
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#444', marginHorizontal: 16, marginVertical: 10 },

  // ── Sections ──
  section:      { paddingHorizontal: 16, marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#f2681c', letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' },
  notesBody:    { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#ddd', lineHeight: 22, marginBottom: 6 },

  // ── Completion ──
  completionCard: { marginHorizontal: 16, marginBottom: 6, backgroundColor: '#3d4a3d', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  completionText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#c8e0c8', lineHeight: 20 },

  // ── Detail rows ──
  detailRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#444' },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel:   { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#888' },
  detailRight:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailValue:   { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#eee' },
  detailLink:    { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#f2681c' },

  // ── Avatars ──
  avatarOrange:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f2681c', justifyContent: 'center', alignItems: 'center' },
  avatarOrangeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  avatarMini:       { width: 22, height: 22, borderRadius: 11, backgroundColor: '#555', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#2e2e2e' },
  avatarMiniText:   { fontSize: 8, fontFamily: 'Inter_600SemiBold', color: '#ccc' },

  // ── Demo guide ──
  demoGuide:     { marginHorizontal: 16, marginVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#f2681c', backgroundColor: '#3a3a3a', padding: 10 },
  demoGuideText: { color: '#d1d5db', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  highlight:     { borderWidth: 1.5, borderColor: '#f2681c', borderRadius: 6 },

  // ── Bottom bar ──
  bottomBar:      { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#444', backgroundColor: '#2e2e2e' },
  btnOutline:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#555', backgroundColor: '#383838' },
  btnOutlineText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  btnOrange:      { flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 10, backgroundColor: '#f2681c' },
  btnOrangeText:  { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // ── Zoom modal ──
  zoomBg:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  zoomWrap:        { flex: 1, width: '100%', justifyContent: 'center' },
  zoomInner:       { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  zoomPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  zoomHint:        { position: 'absolute', bottom: 28, alignSelf: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_400Regular', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  zoomClose:       { position: 'absolute', top: 50, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

  // ── Menu modal ──
  menuBg:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menuCard:          { backgroundColor: '#3a3a3a', borderRadius: 12, width: 240, overflow: 'hidden' },
  menuRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#444' },
  menuRowLast:       { borderBottomWidth: 0 },
  menuRowText:       { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#ccc' },
  menuRowTextDanger: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#f87171' },

  // ── Bottom sheets / modals ──
  modalBg:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: '#333', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  sheetTitle:        { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#fff', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#444' },
  sheetScroll:       { maxHeight: 320 },
  sheetRow:          { paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#444' },
  sheetRowText:      { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#fff' },
  sheetRowSub:       { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 3 },
  sheetEmpty:        { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#888', paddingHorizontal: 20, paddingVertical: 20 },
  sheetBtnPrimary:   { marginTop: 14, marginHorizontal: 20, paddingVertical: 12, backgroundColor: '#f2681c', borderRadius: 8, alignItems: 'center' },
  sheetBtnSecondary: { marginTop: 8, marginHorizontal: 20, paddingVertical: 12, backgroundColor: '#4a4a4a', borderRadius: 8, alignItems: 'center' },
  sheetBtnText:      { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
