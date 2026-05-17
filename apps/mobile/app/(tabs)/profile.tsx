import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { LogOut, Settings } from 'lucide-react-native'
import { api } from '@/lib/api'
import { signOut } from '@/lib/auth'
import { useAuthStore } from '@/lib/store'

export default function ProfileScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'
  const clear = useAuthStore((s) => s.clear)

  const { data: account, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.accounts.verifyCredentials,
  })

  const textColor = dark ? '#f9fafb' : '#111827'
  const mutedColor = dark ? '#9ca3af' : '#6b7280'
  const bg = dark ? '#1A1A1A' : '#FFFBF8'
  const cardBg = dark ? '#1f1f1f' : '#ffffff'
  const borderColor = dark ? '#2a2a2a' : '#f3f4f6'

  async function handleSignOut() {
    Alert.alert('Çıkış Yap', 'Hesabından çıkmak istediğinden emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          clear()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator color="#E8593C" />
      </View>
    )
  }

  if (!account) return null

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }}>
      <Image
        source={{ uri: account.header || undefined }}
        style={[styles.header, { backgroundColor: borderColor }]}
        resizeMode="cover"
      />

      <View style={[styles.profileSection, { backgroundColor: cardBg }]}>
        <View style={styles.avatarRow}>
          <Image source={{ uri: account.avatar }} style={styles.avatar} />
          <TouchableOpacity style={styles.iconBtn} onPress={handleSignOut}>
            <LogOut size={18} color={mutedColor} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.displayName, { color: textColor }]}>
          {account.display_name || account.username}
        </Text>
        <Text style={[styles.handle, { color: mutedColor }]}>@{account.acct}</Text>

        {account.note ? (
          <Text style={[styles.bio, { color: textColor }]} numberOfLines={4}>
            {account.note.replace(/<[^>]+>/g, '').trim()}
          </Text>
        ) : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: textColor }]}>{account.statuses_count}</Text>
            <Text style={[styles.statLabel, { color: mutedColor }]}>Gönderi</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: textColor }]}>{account.following_count}</Text>
            <Text style={[styles.statLabel, { color: mutedColor }]}>Takip</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: textColor }]}>{account.followers_count}</Text>
            <Text style={[styles.statLabel, { color: mutedColor }]}>Takipçi</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { height: 140, width: '100%' },
  profileSection: { padding: 16, marginTop: -1 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: -32 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#fff', backgroundColor: '#e5e7eb' },
  iconBtn: { padding: 8 },
  displayName: { fontWeight: '800', fontSize: 20, marginTop: 8 },
  handle: { fontSize: 14, marginTop: 2 },
  bio: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  stats: { flexDirection: 'row', marginTop: 16, gap: 24 },
  stat: { alignItems: 'center' },
  statNum: { fontWeight: '700', fontSize: 18 },
  statLabel: { fontSize: 12, marginTop: 2 },
})
