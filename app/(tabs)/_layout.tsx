import React, { useState, useCallback, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native'; 
import { Tabs, router } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { registerAndSavePushToken } from '../../lib/notifications/push';

const FONT_LOAD_TIMEOUT_MS = 5000; // Show tabs after 5s even if fonts still loading

export default function TabsLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (mounted) setUnreadCount(0);
          return; // No redirect: tabs stay visible with sign-in prompts
        }
        // Redirect pending/denied users to approval screen (e.g. reopened app after status change)
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', session.user.id)
          .single();
        const status = profile?.status ?? 'active';
        if (mounted && status === 'pending') {
          router.replace('/pending-approval');
          return;
        }
        if (mounted && status === 'denied') {
          router.replace('/pending-approval?status=denied');
          return;
        }
        if (mounted && status === 'active') {
          registerAndSavePushToken().catch(() => {});
        }
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .is('read_at', null);
        if (mounted && !error) setUnreadCount(count ?? 0);
      })();
      return () => { mounted = false; };
    }, [])
  );

  // Show spinner until fonts load; after timeout show tabs anyway so app never sticks
  if (!fontsLoaded && !fontTimeout) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color="#f2681c" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#3b3b3b',
          borderTopColor: '#4a4a4a',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#f2681c',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontFamily: 'Inter_400Regular',
          fontSize: 12,
        },
        tabBarIconStyle: {
          marginBottom: 4,
        },
        tabBarBadgeStyle: {
          backgroundColor: '#f2681c',
          color: '#fff',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tickets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size || 24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingRoot: { flex: 1, backgroundColor: '#3b3b3b', justifyContent: 'center', alignItems: 'center' },
});
