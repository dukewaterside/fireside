import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { BUILDING_LABELS } from '../../lib/constants/tickets';

type NotificationRow = {
  id: string;
  recipient_id: string;
  type: 'user_approval' | 'new_ticket' | 'ticket_assigned';
  related_id: string;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_TITLES: Record<string, string> = {
  user_approval: 'User needs approval',
  new_ticket: 'New ticket created',
  ticket_assigned: 'Ticket assigned to you',
};

// related_id (user_approval) -> profile status so we can show "User Approved" after approval
type RelatedStatusMap = Record<string, string>;
type RelatedUserMap = Record<string, string>;

type TicketInfo = { unit_number: string; building_element: string };
type TicketInfoMap = Record<string, TicketInfo>;

const DISMISS_WIDTH = 88;

function getNotificationTitle(item: NotificationRow, ticketInfoMap: TicketInfoMap): string {
  if (item.type === 'new_ticket') {
    const info = ticketInfoMap[item.related_id];
    if (info) {
      const element = info.building_element
        ? (BUILDING_LABELS as Record<string, string>)[info.building_element] ?? info.building_element
        : null;
      const parts = [info.unit_number ? `Unit ${info.unit_number}` : null, element].filter(Boolean);
      if (parts.length) return `New Ticket — ${parts.join(' • ')}`;
    }
    return 'New Ticket Created';
  }
  if (item.type === 'ticket_assigned') {
    const info = ticketInfoMap[item.related_id];
    if (info) {
      const element = info.building_element
        ? (BUILDING_LABELS as Record<string, string>)[info.building_element] ?? info.building_element
        : null;
      const parts = [info.unit_number ? `Unit ${info.unit_number}` : null, element].filter(Boolean);
      if (parts.length) return `Ticket Assigned — ${parts.join(' • ')}`;
    }
    return 'Ticket Assigned to You';
  }
  return NOTIFICATION_TITLES[item.type] ?? item.type;
}

function SwipeableRow({ onDismiss, children }: { onDismiss: () => void; children: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (isOpen.current) {
          translateX.setValue(Math.max(-DISMISS_WIDTH, Math.min(0, g.dx - DISMISS_WIDTH)));
        } else {
          translateX.setValue(Math.max(-DISMISS_WIDTH, Math.min(0, g.dx)));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (!isOpen.current && g.dx < -(DISMISS_WIDTH / 2)) {
          Animated.spring(translateX, { toValue: -DISMISS_WIDTH, useNativeDriver: true }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  return (
    <View style={swipeStyles.wrapper}>
      <View style={swipeStyles.dismissAction}>
        <TouchableOpacity style={swipeStyles.dismissButton} onPress={onDismiss} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={swipeStyles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

type NotificationFilter = 'all' | 'tickets' | 'approvals';

function filterNotifications(list: NotificationRow[], filter: NotificationFilter): NotificationRow[] {
  if (filter === 'all') return list;
  if (filter === 'tickets') return list.filter((n) => n.type === 'new_ticket' || n.type === 'ticket_assigned');
  return list.filter((n) => n.type === 'user_approval');
}

export default function NotificationsScreen() {
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [relatedStatus, setRelatedStatus] = useState<RelatedStatusMap>({});
  const [relatedUserName, setRelatedUserName] = useState<RelatedUserMap>({});
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [ticketInfoMap, setTicketInfoMap] = useState<TicketInfoMap>({});
  const hasLoadedRef = useRef(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

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
      .order('created_at', { ascending: false });

    if (e) {
      setError(e.message || 'Could not load notifications.');
      setList([]);
      return;
    }
    const rows = (data as NotificationRow[]) ?? [];
    setList(rows);

    // Fetch ticket details for new_ticket / ticket_assigned so we can show descriptive titles
    const ticketIds = [...new Set(
      rows.filter((n) => n.type === 'new_ticket' || n.type === 'ticket_assigned').map((n) => n.related_id)
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

  const openNotification = useCallback(
    async (item: NotificationRow) => {
      if (!item.read_at) await markAsRead(item.id);

      if (item.type === 'user_approval') {
        // Show approve action in-place or in a detail view; we'll show Approve button in the row / modal
        return;
      }
      if (item.type === 'new_ticket' || item.type === 'ticket_assigned') {
        router.push({ pathname: '/tickets/[id]', params: { id: item.related_id } });
      }
    },
    [markAsRead]
  );

  useEffect(() => {
    if (userRole !== 'owner' && filter === 'approvals') {
      setFilter('all');
    }
  }, [userRole]);

  if (!fontsLoaded) return null;

  const filteredList = filterNotifications(list, filter);
  const showApprovalsFilter = userRole === 'owner';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'tickets' && styles.filterButtonActive]}
            onPress={() => setFilter((f) => (f === 'tickets' ? 'all' : 'tickets'))}
          >
            <Text style={[styles.filterButtonText, filter === 'tickets' && styles.filterButtonTextActive]}>
              Tickets
            </Text>
          </TouchableOpacity>
          {showApprovalsFilter && (
            <TouchableOpacity
              style={[styles.filterButton, filter === 'approvals' && styles.filterButtonActive]}
              onPress={() => setFilter((f) => (f === 'approvals' ? 'all' : 'approvals'))}
            >
              <Text style={[styles.filterButtonText, filter === 'approvals' && styles.filterButtonTextActive]}>
                Approvals
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2681c" />
          }
          renderItem={({ item }) => {
            const isUnread = !item.read_at;
            const rowContent = (
              <View style={[styles.row, isUnread && styles.rowUnread]}>
                <TouchableOpacity
                  style={styles.rowTouchable}
                  onPress={() => openNotification(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowDot, isUnread && styles.rowDotUnread]} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{getNotificationTitle(item, ticketInfoMap)}</Text>
                    {item.type === 'user_approval' && (
                      <Text style={styles.rowSubTitle}>
                        User: {relatedUserName[item.related_id] ?? 'Loading...'}
                      </Text>
                    )}
                    <Text style={styles.rowDate}>
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {item.type === 'user_approval' && (
                      relatedStatus[item.related_id] === 'active' ? (
                        <View style={styles.approvedBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#6a6" />
                          <Text style={styles.approvedBadgeText}>User approved</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.approveButton, approvingId === item.related_id && styles.approveButtonDisabled]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleApproveUser(item.related_id, item.id);
                          }}
                          disabled={!!approvingId}
                        >
                          {approvingId === item.related_id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={20} color="#fff" />
                              <Text style={styles.approveButtonText}>Approve user</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )
                    )}
                    {(item.type === 'new_ticket' || item.type === 'ticket_assigned') && (
                      <View style={styles.viewTicketButton}>
                        <Text style={styles.viewTicketButtonText}>View ticket</Text>
                        <Ionicons name="chevron-forward" size={18} color="#f2681c" />
                      </View>
                    )}
                  </View>
                  {isUnread && (
                    <TouchableOpacity
                      style={styles.markReadIconButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        markAsRead(item.id);
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Ionicons name="checkmark-done-outline" size={22} color="#999" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            );
            return (
              <SwipeableRow key={item.id} onDismiss={() => dismissNotification(item.id)}>
                {rowContent}
              </SwipeableRow>
            );
          }}
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
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
  },
  filterButtonActive: {
    backgroundColor: '#f2681c',
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#999',
  },
  filterButtonTextActive: {
    color: '#fff',
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  row: {
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  rowUnread: {
    backgroundColor: '#4f4a45',
    borderLeftWidth: 3,
    borderLeftColor: '#f2681c',
  },
  rowTouchable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    minHeight: 56,
  },
  rowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
    marginRight: 12,
    marginTop: 6,
  },
  rowDotUnread: {
    backgroundColor: '#f2681c',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  rowDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    marginTop: 4,
  },
  rowSubTitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#bbb',
    marginTop: 4,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f2681c',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  approveButtonDisabled: {
    opacity: 0.7,
  },
  approveButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  approvedBadgeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#6a6',
  },
  viewTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  viewTicketButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
  },
  markReadIconButton: {
    padding: 8,
    marginLeft: 4,
    justifyContent: 'center',
    alignSelf: 'center',
  },
});

const swipeStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
    borderRadius: 8,
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
  dismissButton: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 3,
  },
});
