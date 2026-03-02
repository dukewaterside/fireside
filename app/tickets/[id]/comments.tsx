import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase/client';
import { navigateToSignIn } from '../../../lib/navigation';

type CommentRow = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

function authorLabel(c: CommentRow): string {
  const p = c.profiles;
  if (!p) return 'Unknown';
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return name || p.email || 'Unknown';
}

export default function TicketCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [list, setList] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const fetchComments = useCallback(async () => {
    if (!id) return;
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError('Sign in to view the message board.');
      setList([]);
      return;
    }
    const { data, error: fetchErr } = await supabase
      .from('ticket_comments')
      .select('id, ticket_id, user_id, message, created_at, profiles(first_name, last_name, email)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message || 'Could not load comments.');
      setList([]);
      return;
    }
    setList((data as CommentRow[]) ?? []);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        await fetchComments();
        if (mounted) setLoading(false);
      })();
      return () => {
        mounted = false;
      };
    }, [fetchComments])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchComments();
    setRefreshing(false);
  }, [fetchComments]);

  const handlePost = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || !id) return;
    setPosting(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPosting(false);
      setError('Sign in to post comments.');
      return;
    }

    const { error: insertErr } = await supabase.from('ticket_comments').insert({
      ticket_id: id,
      user_id: user.id,
      message: trimmed,
    });

    setPosting(false);
    if (insertErr) {
      setError(insertErr.message || 'Could not post comment.');
      return;
    }
    setMessage('');
    await fetchComments();
  }, [id, message, fetchComments]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Message Board</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f2681c" />
        </View>
      ) : error && list.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={56} color="#666" />
          <Text style={styles.emptyTitle}>{error}</Text>
          {error.includes('Sign in') ? (
            <TouchableOpacity style={styles.retryButton} onPress={navigateToSignIn}>
              <Text style={styles.retryButtonText}>Sign in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.retryButton} onPress={fetchComments}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.boardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2681c" />
            }
            renderItem={({ item }) => (
              <View style={styles.commentCard}>
                <View style={styles.commentTop}>
                  <Text style={styles.author}>{authorLabel(item)}</Text>
                  <Text style={styles.time}>
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={styles.message}>{item.message}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbox-ellipses-outline" size={52} color="#666" />
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.emptySubtitle}>Start the discussion below.</Text>
              </View>
            }
          />

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Write a comment..."
              placeholderTextColor="#888"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.postButton, (!message.trim() || posting) && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={!message.trim() || posting}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3b3b3b' },
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
  headerRight: { width: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  boardWrap: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 12 },
  commentCard: {
    backgroundColor: '#4a4a4a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  commentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
  },
  author: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  time: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  message: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#ddd',
    lineHeight: 22,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#4a4a4a',
    backgroundColor: '#3b3b3b',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#4a4a4a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  postButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2681c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    textAlign: 'center',
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
});
