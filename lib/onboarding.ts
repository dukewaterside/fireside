import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_VERSION = 'v4';

function completedKey(userId: string): string {
  return `onboarding_completed:${ONBOARDING_VERSION}:${userId}`;
}

function homeDemoKey(userId: string): string {
  return `onboarding_home_demo_pending:${ONBOARDING_VERSION}:${userId}`;
}

type HomeDemoProgress = {
  units: boolean;
  tickets: boolean;
  notifications: boolean;
};

const DEFAULT_PROGRESS: HomeDemoProgress = {
  units: false,
  tickets: false,
  notifications: false,
};

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(completedKey(userId));
  return value === '1';
}

export async function markOnboardingCompleted(userId: string): Promise<void> {
  await AsyncStorage.setItem(completedKey(userId), '1');
  await AsyncStorage.setItem(homeDemoKey(userId), '1');
  await AsyncStorage.setItem(homeDemoProgressKey(userId), JSON.stringify(DEFAULT_PROGRESS));
}

export async function isHomeDemoPending(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(homeDemoKey(userId));
  return value === '1';
}

export async function completeHomeDemo(userId: string): Promise<void> {
  await AsyncStorage.removeItem(homeDemoKey(userId));
  await AsyncStorage.removeItem(homeDemoProgressKey(userId));
}

function homeDemoProgressKey(userId: string): string {
  return `onboarding_home_demo_progress:${ONBOARDING_VERSION}:${userId}`;
}

export async function getHomeDemoProgress(userId: string): Promise<HomeDemoProgress> {
  const raw = await AsyncStorage.getItem(homeDemoProgressKey(userId));
  if (!raw) return { ...DEFAULT_PROGRESS };
  try {
    const parsed = JSON.parse(raw) as Partial<HomeDemoProgress>;
    return {
      units: !!parsed.units,
      tickets: !!parsed.tickets,
      notifications: !!parsed.notifications,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export async function markHomeDemoStep(
  userId: string,
  step: keyof HomeDemoProgress
): Promise<HomeDemoProgress> {
  const current = await getHomeDemoProgress(userId);
  const next = { ...current, [step]: true };
  await AsyncStorage.setItem(homeDemoProgressKey(userId), JSON.stringify(next));
  if (next.units && next.tickets && next.notifications) {
    await AsyncStorage.removeItem(homeDemoKey(userId));
  }
  return next;
}
