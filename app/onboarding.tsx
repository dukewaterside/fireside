import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase/client';
import { markOnboardingCompleted } from '../lib/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Minimum touch target size (Apple HIG); use hitSlop to extend small buttons
const MIN_TOUCH_SLOP = 22;

type Slide = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    icon: 'flame-outline',
    title: 'Welcome to Fireside',
    body: 'Track units, create tickets, assign contacts, and stay updated in one place.',
  },
  {
    id: 'units',
    icon: 'business-outline',
    title: 'Units + Map',
    body: 'On Home, tap Units to open the full list. Tap any unit to open details and create tickets for that unit.',
  },
  {
    id: 'tickets',
    icon: 'ticket-outline',
    title: 'Create + View Tickets',
    body: 'View all tickets, open details, mark them resolved, and use the Message Board for live conversation about each ticket.',
  },
  {
    id: 'contacts',
    icon: 'people-outline',
    title: 'Contacts + Assignments',
    body: 'Use Contacts to call people quickly and view unit assignments for PMs/designers.',
  },
  {
    id: 'notifications',
    icon: 'notifications-outline',
    title: 'Notifications',
    body: 'Tap the bell badge to open updates. Ticket alerts deep-link directly to the ticket.',
  },
  {
    id: 'demo',
    icon: 'hand-left-outline',
    title: 'Quick Interactive Demo',
    body: 'After this, we will highlight key Home actions so you can tap through them once.',
  },
];

export default function OnboardingScreen() {
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const atEnd = index === SLIDES.length - 1;
  const current = useMemo(() => SLIDES[index] ?? SLIDES[0], [index]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, nextIndex)));
  };

  const finish = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await markOnboardingCompleted(session.user.id);
    }
    router.replace('/(tabs)');
  };

  const goNext = () => {
    if (atEnd) {
      finish();
      return;
    }
    const next = Math.min(index + 1, SLIDES.length - 1);
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Text style={styles.progress}>{index + 1}/{SLIDES.length}</Text>
        {!atEnd ? (
          <Pressable
            onPress={finish}
            hitSlop={MIN_TOUCH_SLOP}
            style={({ pressed }) => [styles.skipWrap, pressed && styles.skipPressed]}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.slidesList}
        contentContainerStyle={styles.slidesListContent}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={40} color="#f2681c" />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View key={slide.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>{current.title}</Text>
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
          hitSlop={MIN_TOUCH_SLOP}
          accessibilityRole="button"
          accessibilityLabel={atEnd ? 'Start Using Fireside' : 'Next'}
        >
          <Text style={styles.nextButtonText}>{atEnd ? 'Start Using Fireside' : 'Next'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3b3b3b',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  progress: {
    color: '#9ca3af',
    fontSize: 13,
  },
  skipWrap: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipPressed: {
    opacity: 0.7,
  },
  skip: {
    color: '#f2681c',
    fontSize: 14,
    fontWeight: '600',
  },
  slidesList: {
    flex: 1,
  },
  slidesListContent: {
    flexGrow: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a4a4a',
    marginBottom: 22,
  },
  title: {
    fontSize: 26,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#666',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#f2681c',
  },
  footer: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  footerHint: {
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 13,
  },
  nextButton: {
    backgroundColor: '#f2681c',
    borderRadius: 10,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonPressed: {
    opacity: 0.9,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
