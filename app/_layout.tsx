import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#3b3b3b" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#3b3b3b' },
          navigationBarColor: '#3b3b3b',
        }}
      />
    </>
  );
}
