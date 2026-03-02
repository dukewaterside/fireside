import { Stack } from 'expo-router';

export default function TicketsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#3b3b3b' },
      }}
    />
  );
}
