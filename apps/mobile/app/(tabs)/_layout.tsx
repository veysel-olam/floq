import { Tabs } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Home, Search, Bell, User } from 'lucide-react-native'

const CORAL = '#E8593C'
const INACTIVE = '#9ca3af'

export default function TabsLayout() {
  const colorScheme = useColorScheme()
  const bg = colorScheme === 'dark' ? '#1A1A1A' : '#FFFBF8'
  const border = colorScheme === 'dark' ? '#2a2a2a' : '#f3f4f6'

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: CORAL,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: { backgroundColor: bg, borderTopColor: border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: bg },
        headerTintColor: CORAL,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Akış',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Bildirimler',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
