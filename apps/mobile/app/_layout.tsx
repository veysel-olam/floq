import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useColorScheme } from 'react-native'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
})

const CORAL = '#E8593C'
const BG_LIGHT = '#FFFBF8'
const BG_DARK = '#1A1A1A'

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const bg = colorScheme === 'dark' ? BG_DARK : BG_LIGHT

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: bg },
            headerTintColor: CORAL,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="status/[id]" options={{ title: 'Gönderi' }} />
          <Stack.Screen name="profile/[acct]" options={{ title: 'Profil' }} />
          <Stack.Screen name="compose" options={{ title: 'Yeni Gönderi', presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
