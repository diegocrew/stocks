import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MarketProvider } from '../store';
import { colors } from '../theme';

export default function Layout() {
  return <MarketProvider>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" options={{ title: 'Stock Atlas' }} />
      <Stack.Screen name="directory" options={{ title: 'Company directory' }} />
      <Stack.Screen name="stock/[symbol]" options={{ title: 'Company detail' }} />
    </Stack>
  </MarketProvider>;
}
