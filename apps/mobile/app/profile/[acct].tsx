import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  FlatList,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { StatusCard } from '@/components/StatusCard'

export default function ProfileScreen() {
  const { acct } = useLocalSearchParams<{ acct: string }>()
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'
  const qc = useQueryClient()

  const textColor = dark ? '#f9fafb' : '#111827'
  const mutedColor = dark ? '#9ca3af' : '#6b7280'
  const bg = dark ? '#1A1A1A' : '#FFFBF8'
  const borderColor = dark ? '#2a2a2a' : '#f3f4f6'

  const { data: results } = useQuery({
    queryKey: ['account-search', acct],
    queryFn: () => api.accounts.search(acct!),
    enabled: !!acct,
    select: (r) => r[0],
  })

  const account = results

  const { data: statuses, isLoading: loadingStatuses } = useQuery({
    queryKey: ['account-statuses', account?.id],
    queryFn: () => api.accounts.statuses(account!.id),
    enabled: !!account?.id,
  })

  const { data: meData } = useQuery({ queryKey: ['me'], queryFn: api.accounts.verifyCredentials })
  const isSelf = meData?.acct === acct

  async function handleFollow() {
    if (!account) return
    try {
      await api.accounts.follow(account.id)
      qc.invalidateQueries({ queryKey: ['account-search', acct] })
    } catch {}
  }

  if (!account) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator color="#E8593C" />
      </View>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }}>
      <Image
        source={{ uri: account.header || undefined }}
        style={[styles.header, { backgroundColor: borderColor }]}
        resizeMode="cover"
      />

      <View style={{ padding: 16 }}>
        <View style={styles.avatarRow}>
          <Image source={{ uri: account.avatar }} style={styles.avatar} />
          {!isSelf && (
            <TouchableOpacity style={styles.followBtn} onPress={handleFollow}>
              <Text style={styles.followBtnText}>Takip Et</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.displayName, { color: textColor }]}>
          {account.display_name || account.username}
        </Text>
        <Text style={[styles.handle, { color: mutedColor }]}>@{account.acct}</Text>

        {account.note ? (
          <Text style={[styles.bio, { color: textColor }]}>
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

      {loadingStatuses ? (
        <ActivityIndicator color="#E8593C" style={{ marginTop: 20 }} />
      ) : (
        (statuses ?? []).map((s) => <StatusCard key={s.id} status={s} />)
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { height: 120, width: '100%' },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -28 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#fff', backgroundColor: '#e5e7eb' },
  followBtn: {
    backgroundColor: '#E8593C',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  followBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  displayName: { fontWeight: '800', fontSize: 18, marginTop: 8 },
  handle: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  stats: { flexDirection: 'row', marginTop: 14, gap: 20 },
  stat: { alignItems: 'center' },
  statNum: { fontWeight: '700', fontSize: 16 },
  statLabel: { fontSize: 11, marginTop: 1 },
})
