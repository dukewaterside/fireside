import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';

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

export default function NotificationsScreen() {
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [relatedStatus, setRelatedStatus] = useState<RelatedStatusMap>({});

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
      setError('Sign in to see notifications.');
      return;
    }
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

    // For user_approval items, fetch related profile status so we can show "User Approved" when already approved
    const approvalIds = [...new Set(rows.filter((n) => n.type === 'user_approval').map((n) => n.related_id))];
    if (approvalIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, status')
        .in('id', approvalIds);
      const statusMap: RelatedStatusMap = {};
      (profiles ?? []).forEach((p: { id: string; status: string | null }) => {
        statusMap[p.id] = p.status ?? 'pending';
      });
      setRelatedStatus((prev) => ({ ...prev, ...statusMap }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        await fetchNotifications();
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

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
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
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2681c" />
          }
          renderItem={({ item }) => {
            const isUnread = !item.read_at;
            const rowContent = (
              <TouchableOpacity
                style={[styles.row, isUnread && styles.rowUnread]}
                onPress={() => openNotification(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.rowDot, isUnread && styles.rowDotUnread]} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{NOTIFICATION_TITLES[item.type] ?? item.type}</Text>
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
                    <TouchableOpacity
                      style={styles.viewTicketButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({ pathname: '/tickets/[id]', params: { id: item.related_id } });
                      }}
                    >
                      <Text style={styles.viewTicketButtonText}>View ticket</Text>
                      <Ionicons name="chevron-forward" size={18} color="#f2681c" />
                    </TouchableOpacity>
                  )}
                  {!item.read_at && (
                    <TouchableOpacity
                      style={styles.markReadButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        markAsRead(item.id);
                      }}
                    >
                      <Text style={styles.markReadButtonText}>Mark as read</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
            return <View key={item.id}>{rowContent}</View>;
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  rowUnread: {
    backgroundColor: '#4f4a45',
    borderLeftWidth: 3,
    borderLeftColor: '#f2681c',
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
  markReadButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  markReadButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
});
