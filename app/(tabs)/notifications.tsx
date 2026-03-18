import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { BUILDING_LABELS } from '../../lib/constants/tickets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationRow = {
  id: string;
  recipient_id: string;
  type: 'user_approval' | 'new_ticket' | 'ticket_assigned' | 'new_comment';
  related_id: string;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_TITLES: Record<string, string> = {
  user_approval: 'User needs approval',
  new_ticket: 'New ticket created',
  ticket_assigned: 'Ticket assigned to you',
  new_comment: 'New comment',
};

// related_id (user_approval) -> profile status so we can show "User Approved" after approval
type RelatedStatusMap = Record<string, string>;
type RelatedUserMap = Record<string, string>;

type TicketInfo = { unit_number: string; building_element: string };
type TicketInfoMap = Record<string, TicketInfo>;

type NotificationFilter = 'all' | 'tickets' | 'approvals';

// ---------------------------------------------------------------------------
// Helpers (preserved)
// ---------------------------------------------------------------------------

function getNotificationTitle(item: NotificationRow, ticketInfoMap: TicketInfoMap, commentDataMap: Record<string, { ticket_id: string; message: string; author_name: string }>): string {
  if (item.type === 'new_ticket') {
    const info = ticketInfoMap[item.related_id];
    if (info?.unit_number) return `New ticket in ${info.unit_number}`;
    return 'New ticket created';
  }
  if (item.type === 'ticket_assigned') {
    const info = ticketInfoMap[item.related_id];
    if (info?.unit_number) return `Assigned to you — ${info.unit_number}`;
    return 'Ticket assigned to you';
  }
  if (item.type === 'new_comment') {
    const comment = commentDataMap[item.related_id];
    const info = comment?.ticket_id ? ticketInfoMap[comment.ticket_id] : undefined;
    if (info?.unit_number) return `New comment on ${info.unit_number}`;
    return 'New comment on a ticket';
  }
  if (item.type === 'user_approval') return 'New user awaiting approval';
  return NOTIFICATION_TITLES[item.type] ?? item.type;
}

function getNotificationSubtitle(item: NotificationRow, ticketInfoMap: TicketInfoMap, commentDataMap: Record<string, { ticket_id: string; message: string; author_name: string }>, relatedUserName: RelatedUserMap): string | null {
  if (item.type === 'new_ticket' || item.type === 'ticket_assigned') {
    const info = ticketInfoMap[item.related_id];
    if (info?.building_element) {
      return (BUILDING_LABELS as Record<string, string>)[info.building_element] ?? info.building_element;
    }
    return null;
  }
  if (item.type === 'new_comment') {
    const comment = commentDataMap[item.related_id];
    if (comment) return `${comment.author_name}: ${comment.message}`;
    return null;
  }
  if (item.type === 'user_approval') {
    return relatedUserName[item.related_id] ?? null;
  }
  return null;
}

function filterNotifications(list: NotificationRow[], filter: NotificationFilter): NotificationRow[] {
  if (filter === 'all') return list;
  if (filter === 'tickets') return list.filter((n) => n.type === 'new_ticket' || n.type === 'ticket_assigned' || n.type === 'new_comment');
  return list.filter((n) => n.type === 'user_approval');
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'Just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ---------------------------------------------------------------------------
// Time-grouping helper
// ---------------------------------------------------------------------------

type SectionData = { title: string; data: NotificationRow[] };

function groupByTimePeriod(items: NotificationRow[]): SectionData[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Start of this week (Sunday)
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();

  const today: NotificationRow[] = [];
  const thisWeek: NotificationRow[] = [];
  const earlier: NotificationRow[] = [];

  for (const item of items) {
    const ts = new Date(item.created_at).getTime();
    if (ts >= todayStart) {
      today.push(item);
    } else if (ts >= weekStart) {
      thisWeek.push(item);
    } else {
      earlier.push(item);
    }
  }

  const sections: SectionData[] = [];
  if (today.length > 0) sections.push({ title: 'Today', data: today });
  if (thisWeek.length > 0) sections.push({ title: 'This Week', data: thisWeek });
  if (earlier.length > 0) sections.push({ title: 'Earlier', data: earlier });

  return sections;
}

// ---------------------------------------------------------------------------
// Notification icon helper
// ---------------------------------------------------------------------------

function getNotificationIcon(type: NotificationRow['type']): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case 'new_ticket':
    case 'ticket_assigned':
      return { name: 'document-text', color: '#f2681c' };
    case 'user_approval':
      return { name: 'person-add', color: '#6fcf7a' };
    case 'new_comment':
      return { name: 'chatbubble', color: '#5b9bd5' };
    default:
      return { name: 'notifications', color: '#f2681c' };
  }
}

// ---------------------------------------------------------------------------
// SwipeableRow — smooth PanResponder with spring animation
// ---------------------------------------------------------------------------

const DISMISS_WIDTH = 70;
const SWIPE_DISMISS_THRESHOLD = 72;
const VELOCITY_DISMISS_THRESHOLD = 0.4;

function SwipeableRow({ onDismiss, children }: { onDismiss: () => void; children: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_, g) => {
        const dx = Math.min(0, g.dx);
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        const velocityLeft = g.vx < 0 ? -g.vx : 0;
        const shouldDismiss =
          g.dx < -SWIPE_DISMISS_THRESHOLD || velocityLeft > VELOCITY_DISMISS_THRESHOLD;

        if (shouldDismiss) {
          Animated.spring(translateX, {
            toValue: -screenWidth,
            useNativeDriver: true,
            speed: 28,
            bounciness: 0,
          }).start(() => onDismiss());
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 300,
            friction: 30,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={swipeStyles.wrapper}>
      <View style={swipeStyles.dismissAction}>
        <Ionicons name="trash-outline" size={22} color="#fff" />
      </View>
      <Animated.View
        style={[swipeStyles.foreground, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NotificationsScreen() {
  // ---- State (all preserved) ----
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [relatedStatus, setRelatedStatus] = useState<RelatedStatusMap>({});
  const [relatedUserName, setRelatedUserName] = useState<RelatedUserMap>({});
  const [filter, setFilter] = useState<NotificationFilter>('tickets');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [ticketInfoMap, setTicketInfoMap] = useState<TicketInfoMap>({});
  const [commentDataMap, setCommentDataMap] = useState<Record<string, { ticket_id: string; message: string; author_name: string }>>({});
  const hasLoadedRef = useRef(false);

  // UI-only state
  const [menuVisible, setMenuVisible] = useState(false);
  const [denyingId, setDenyingId] = useState<string | null>(null);

  // ---- Fonts ----
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // ---- Data fetching (all preserved) ----
  const fetchNotifications = useCallback(async () => {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setList([]);
      setRelatedStatus({});
      setRelatedUserName({});
      setUserRole(null);
      setError('Sign in to see notifications.');
      return;
    }
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    setUserRole((profileData as { role: string } | null)?.role ?? null);

    const { data, error: e } = await supabase
      .from('notifications')
      .select('id, recipient_id, type, related_id, read_at, created_at')
      .eq('recipient_id', session.user.id)
      .order('created_at', { ascending: false });

    if (e) {
      setError(e.message || 'Could not load notifications.');
      setList([]);
      return;
    }
    const rows = (data as NotificationRow[]) ?? [];
    setList(rows);

    // Fetch comment details for new_comment to get the ticket_id and message
    const commentIds = [...new Set(rows.filter((n) => n.type === 'new_comment').map((n) => n.related_id))];
    const commentMap: Record<string, { ticket_id: string; message: string; author_name: string }> = {};
    if (commentIds.length > 0) {
      const { data: comments } = await supabase
        .from('ticket_comments')
        .select('id, ticket_id, message, profiles(first_name, last_name)')
        .in('id', commentIds);
      (comments ?? []).forEach((c) => {
        const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        const authorName = p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : 'Someone';
        commentMap[c.id] = { ticket_id: c.ticket_id, message: c.message, author_name: authorName };
      });
    }
    setCommentDataMap(commentMap);

    // Fetch ticket details for new_ticket / ticket_assigned / new_comment so we can show descriptive titles
    const ticketIds = [...new Set(
      rows.map((n) => {
        if (n.type === 'new_ticket' || n.type === 'ticket_assigned') return n.related_id;
        if (n.type === 'new_comment') return commentMap[n.related_id]?.ticket_id;
        return null;
      }).filter(Boolean) as string[]
    )];
    if (ticketIds.length > 0) {
      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, building_element, units(unit_number)')
        .in('id', ticketIds);
      const infoMap: TicketInfoMap = {};
      (tickets ?? []).forEach((t: any) => {
        const unit = Array.isArray(t.units) ? t.units[0] : t.units;
        infoMap[t.id] = {
          unit_number: unit?.unit_number ?? '',
          building_element: t.building_element ?? '',
        };
      });
      setTicketInfoMap(infoMap);
    } else {
      setTicketInfoMap({});
    }

    // For user_approval items, fetch related profile status so we can show "User Approved" when already approved
    const approvalIds = [...new Set(rows.filter((n) => n.type === 'user_approval').map((n) => n.related_id))];
    if (approvalIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, status, first_name, last_name, email')
        .in('id', approvalIds);
      const statusMap: RelatedStatusMap = {};
      const nameMap: RelatedUserMap = {};
      (profiles ?? []).forEach((p: { id: string; status: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }) => {
        statusMap[p.id] = p.status ?? 'pending';
        const first = p.first_name?.trim() ?? '';
        const last = p.last_name?.trim() ?? '';
        nameMap[p.id] = [first, last].filter(Boolean).join(' ') || p.email?.trim() || 'Unknown user';
      });
      setRelatedStatus((prev) => ({ ...prev, ...statusMap }));
      setRelatedUserName((prev) => ({ ...prev, ...nameMap }));
    } else {
      setRelatedStatus({});
      setRelatedUserName({});
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        if (!hasLoadedRef.current) setLoading(true);
        await fetchNotifications();
        hasLoadedRef.current = true;
        if (mounted) setLoading(false);
      })();
      return () => { mounted = false; };
    }, [fetchNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  // ---- Callbacks (all preserved) ----

  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    setList((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }, []);

  const dismissNotification = useCallback(async (notificationId: string) => {
    // Optimistic remove immediately
    setList((prev) => prev.filter((n) => n.id !== notificationId));
    // Delete from DB; fall back to mark-as-read if RLS blocks delete
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
    }
  }, []);

  const handleApproveUser = useCallback(
    async (profileId: string, notificationId: string) => {
      setApprovingId(profileId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setApprovingId(null);
        return;
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          status: 'active',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', profileId);

      setApprovingId(null);
      if (updateError) {
        Alert.alert('Error', updateError.message || 'Could not approve user.');
        return;
      }
      setRelatedStatus((prev) => ({ ...prev, [profileId]: 'active' }));
      await markAsRead(notificationId);
      fetchNotifications();
    },
    [markAsRead, fetchNotifications]
  );

  const handleDenyUser = useCallback(
    async (profileId: string, notificationId: string) => {
      Alert.alert(
        'Deny user',
        'Are you sure you want to deny this user? They will not be able to sign in.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deny',
            style: 'destructive',
            onPress: async () => {
              setDenyingId(profileId);
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ status: 'denied' })
                .eq('id', profileId);

              setDenyingId(null);
              if (updateError) {
                Alert.alert('Error', updateError.message || 'Could not deny user.');
                return;
              }
              setRelatedStatus((prev) => ({ ...prev, [profileId]: 'denied' }));
              await markAsRead(notificationId);
              fetchNotifications();
            },
          },
        ]
      );
    },
    [markAsRead, fetchNotifications]
  );

  const openNotification = useCallback(
    async (item: NotificationRow) => {
      if (!item.read_at) await markAsRead(item.id);

      if (item.type === 'user_approval') {
        // Show approve action in-place; we'll show Approve/Deny buttons in the row
        return;
      }
      if (item.type === 'new_ticket' || item.type === 'ticket_assigned') {
        router.push({ pathname: '/tickets/[id]', params: { id: item.related_id } });
      } else if (item.type === 'new_comment') {
        const ticketId = commentDataMap[item.related_id]?.ticket_id;
        if (ticketId) {
          router.push({ pathname: '/tickets/[id]', params: { id: ticketId } });
        }
      }
    },
    [markAsRead, commentDataMap]
  );

  const markAllAsRead = useCallback(async () => {
    setMenuVisible(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const unreadIds = list.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;

    // Optimistic update
    setList((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    );

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', session.user.id)
      .is('read_at', null);
  }, [list]);

  // ---- Filter guard ----
  useEffect(() => {
    if (userRole !== 'owner' && filter === 'approvals') {
      setFilter('tickets');
    }
  }, [userRole]);

  // ---- Derived data ----
  const showApprovalsTab = userRole === 'owner';

  const filteredList = useMemo(
    () => filterNotifications(list, filter),
    [list, filter]
  );

  const sections = useMemo(
    () => groupByTimePeriod(filteredList),
    [filteredList]
  );

  // ---- Font loading screen ----
  if (!fontsLoaded && !fontTimeout) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f2681c" />
          <Text style={[styles.emptySubtitle, { marginTop: 12 }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Subtitle helper ----
  const getSubtitle = (item: NotificationRow): string | null => {
    return getNotificationSubtitle(item, ticketInfoMap, commentDataMap, relatedUserName);
  };

  // ---- Render notification row ----
  const renderItem = ({ item }: { item: NotificationRow }) => {
    const isUnread = !item.read_at;
    const icon = getNotificationIcon(item.type);
    const subtitle = getSubtitle(item);
    const isTicketType = item.type === 'new_ticket' || item.type === 'ticket_assigned' || item.type === 'new_comment';
    const isApproval = item.type === 'user_approval';
    const isAlreadyApproved = isApproval && relatedStatus[item.related_id] === 'active';
    const isAlreadyDenied = isApproval && relatedStatus[item.related_id] === 'denied';

    const rowContent = (
      <Pressable
        style={styles.rowPressable}
        onPress={() => openNotification(item)}
        android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
      >
        <View style={styles.rowInner}>
          {/* Left: icon circle */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: icon.color + '22' }]}>
              <Ionicons name={icon.name} size={18} color={icon.color} />
            </View>
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          {/* Middle: text content */}
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {getNotificationTitle(item, ticketInfoMap, commentDataMap)}
            </Text>
            {subtitle && (
              <Text style={styles.rowSubtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            )}

            {/* Ticket link */}
            {isTicketType && (
              <View style={styles.viewTicketRow}>
                <Text style={styles.viewTicketText}>View ticket</Text>
                <Text style={styles.viewTicketArrow}> →</Text>
              </View>
            )}

            {/* Approval actions */}
            {isApproval && isAlreadyApproved && (
              <Text style={styles.approvedText}>Approved</Text>
            )}
            {isApproval && isAlreadyDenied && (
              <Text style={styles.deniedText}>Denied</Text>
            )}
            {isApproval && !isAlreadyApproved && !isAlreadyDenied && (
              <View style={styles.approvalActions}>
                <TouchableOpacity
                  style={[styles.approveBtn, (approvingId === item.related_id || denyingId === item.related_id) && styles.btnDisabled]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleApproveUser(item.related_id, item.id);
                  }}
                  disabled={!!approvingId || !!denyingId}
                  activeOpacity={0.7}
                >
                  {approvingId === item.related_id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.approveBtnText}>Approve</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.denyBtn, (approvingId === item.related_id || denyingId === item.related_id) && styles.btnDisabled]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDenyUser(item.related_id, item.id);
                  }}
                  disabled={!!approvingId || !!denyingId}
                  activeOpacity={0.7}
                >
                  {denyingId === item.related_id ? (
                    <ActivityIndicator size="small" color="#c0392b" />
                  ) : (
                    <Text style={styles.denyBtnText}>Deny</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Right: relative time */}
          <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={styles.rowDivider} />
      </Pressable>
    );

    return (
      <SwipeableRow key={item.id} onDismiss={() => dismissNotification(item.id)}>
        {rowContent}
      </SwipeableRow>
    );
  };

  // ---- Render section header ----
  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  // ---- Main render ----
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab bar (segmented control) */}
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              filter !== 'approvals' ? styles.tabButtonActive : styles.tabButtonInactive,
            ]}
            onPress={() => setFilter('tickets')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabButtonText,
                filter !== 'approvals' ? styles.tabButtonTextActive : styles.tabButtonTextInactive,
              ]}
            >
              Tickets
            </Text>
          </TouchableOpacity>
          {showApprovalsTab && (
            <TouchableOpacity
              style={[
                styles.tabButton,
                filter === 'approvals' ? styles.tabButtonActive : styles.tabButtonInactive,
              ]}
              onPress={() => setFilter('approvals')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  filter === 'approvals' ? styles.tabButtonTextActive : styles.tabButtonTextInactive,
                ]}
              >
                Approvals
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f2681c" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#f2681c" />
          <Text style={styles.emptyTitle}>{error}</Text>
          {error === 'Sign in to see notifications.' ? (
            <TouchableOpacity style={styles.retryButton} onPress={navigateToSignIn}>
              <Text style={styles.retryButtonText}>Sign in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptySubtitle}>You're all caught up.</Text>
        </View>
      ) : filteredList.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="filter-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>
            {filter === 'tickets' ? 'No ticket notifications' : 'No approval notifications'}
          </Text>
          <Text style={styles.emptySubtitle}>Try another filter.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2681c" />
          }
        />
      )}

      {/* Three-dot menu modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={markAllAsRead} activeOpacity={0.7}>
              <Ionicons name="checkmark-done-outline" size={20} color="#fff" style={{ marginRight: 12 }} />
              <Text style={styles.menuItemText}>Mark all as read</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2e2e2e',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerLeft: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  headerRight: {
    width: 36,
    alignItems: 'flex-end',
  },

  // Tab bar (segmented control)
  tabBarContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#3a3a3a',
    borderRadius: 24,
    padding: 3,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 21,
    minWidth: 100,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#f2681c',
  },
  tabButtonInactive: {
    backgroundColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  tabButtonTextInactive: {
    color: '#999',
  },

  // Section headers
  sectionHeader: {
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Notification row
  rowPressable: {
    backgroundColor: '#2e2e2e',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#444',
    marginLeft: 52,
  },

  // Icon
  iconContainer: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e74c3c',
    borderWidth: 1.5,
    borderColor: '#2e2e2e',
  },

  // Body
  rowBody: {
    flex: 1,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    lineHeight: 20,
  },
  rowSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 3,
    lineHeight: 18,
  },

  // Time
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#777',
    marginTop: 2,
    minWidth: 48,
    textAlign: 'right',
  },

  // View ticket link
  viewTicketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  viewTicketText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
  },
  viewTicketArrow: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#f2681c',
  },

  // Approval actions
  approvalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  approveBtn: {
    backgroundColor: '#f2681c',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 34,
  },
  approveBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  denyBtn: {
    borderWidth: 1,
    borderColor: '#c0392b',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    minHeight: 34,
  },
  denyBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#c0392b',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  approvedText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#6fcf7a',
    marginTop: 8,
  },
  deniedText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#c0392b',
    marginTop: 8,
  },

  // Empty / error states
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
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f2681c',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },

  // Menu modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
});

const swipeStyles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    position: 'relative',
  },
  dismissAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DISMISS_WIDTH,
    backgroundColor: '#c0392b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foreground: {
    backgroundColor: '#2e2e2e',
  },
});
