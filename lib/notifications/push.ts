/**
 * Push notification registration and handlers.
 * - Requests permissions, gets Expo push token, saves to profiles.expo_push_token.
 * - Handles notification tap (navigate to ticket or notifications tab).
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../supabase/client';

const ANDROID_CHANNEL_ID = 'fireside-default';

/** Configure how notifications appear when app is in foreground */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permissions and get Expo push token. Call when user is signed in.
 * Saves token to profiles.expo_push_token so the backend can send pushes.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    final = status;
  }
  if (final !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    (Constants.easConfig?.projectId as string | undefined) ??
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
  const tokenResult = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });
  const token = tokenResult?.data ?? null;
  return token;
}

/**
 * Save Expo push token to the current user's profile. Call after registerForPushNotificationsAsync.
 */
export async function savePushTokenToProfile(token: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return false;
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', session.user.id);
  return !error;
}

/**
 * Register for push and save token. Call once when user is signed in (e.g. on tabs focus).
 * Retries save once if it fails (e.g. session not ready). In __DEV__, logs when token or save fails.
 */
export async function registerAndSavePushToken(): Promise<void> {
  try {
    let token = await registerForPushNotificationsAsync();
    if (!token) {
      // Occasional cold-start race on iOS; a short retry improves reliability.
      await new Promise((resolve) => setTimeout(resolve, 700));
      token = await registerForPushNotificationsAsync();
    }
    if (!token) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[Push] No Expo push token: permission may be denied or not yet requested.');
      }
      return;
    }
    let saved = await savePushTokenToProfile(token);
    if (!saved) {
      // Session might not be ready yet (e.g. right after sign-in). Retry once.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      saved = await savePushTokenToProfile(token);
    }
    if (!saved && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[Push] Failed to save token to profile. Check RLS allows profiles.expo_push_token update for current user.');
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[Push] Registration error:', err);
    }
    // Swallow in production so app continues even if push setup fails.
  }
}

/** Notification payload we attach when sending (type, related_id for deep link) */
export type NotificationData = {
  type?: 'user_approval' | 'new_ticket' | 'ticket_assigned' | 'new_comment';
  related_id?: string;
};

/**
 * Set up listeners for when user receives or taps a notification.
 * Call once at app root (e.g. in _layout).
 */
export function setNotificationResponseHandler(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationData;
    if (data.type === 'new_ticket' || data.type === 'ticket_assigned' || data.type === 'new_comment') {
      if (data.related_id) {
        router.push({ pathname: '/tickets/[id]', params: { id: data.related_id } });
      } else {
        router.push('/tickets');
      }
    } else if (data.type === 'user_approval') {
      router.push('/(tabs)/notifications');
    } else {
      router.push('/(tabs)/notifications');
    }
  });
  return () => sub.remove();
}
