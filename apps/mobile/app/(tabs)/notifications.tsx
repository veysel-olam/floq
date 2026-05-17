import {
  FlatList,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  RefreshControl,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Heart, Repeat2, MessageCircle, UserPlus, AtSign } from 'lucide-react-native'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { api, type MastodonNotification } from '@/lib/api'

const TYPE_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  favourite: { icon: <Heart size={14} color="#E8593C" fill="#E8593C" />, label: 'beğendi' },
  reblog: { icon: <Repeat2 size={14} color="#22c55e" />, label: 'boost\'ladı' },
  mention: { icon: <AtSign size={14} color="#3b82f6" />, label: 'bahsetti' },
  follow: { icon: <UserPlus size={14} color="#8b5cf6" />, label: 'takip etti' },
  reply: { icon: <MessageCircle size={14} color="#6b7280" />, label: 'yanıtladı' },
}

function NotifRow({ notif }: { notif: MastodonNotification }) {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'
  const textColor = dark ? '#f9fafb' : '#111827'
  const mutedColor = dark ? '#9ca3af' : '#6b7280'
  const bg = dark ? '#1f1f1f' : '#ffffff'
  const border = dark ? '#2a2a2a' : '#f3f4f6'

  const meta = TYPE_ICONS[notif.type] ?? TYPE_ICONS.mention
  const timeAgo = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: tr })

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: bg, borderBottomColor: border }]}
      onPress={() => {
        if (notif.status) router.push(`/status/${notif.status.id}`)
        else router.push(`/profile/${notif.account.acct}`)
      }}
    >
      <Image source={{ uri: notif.account.avatar }} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <View style={styles.rowHeader}>
          {meta.icon}
          <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
            {notif.account.display_name || notif.account.username}
          </Text>
          <Text style={[styles.label, { color: mutedColor }]}>{meta.label}</Text>
        </View>
        <Text style={[styles.time, { color: mutedColor }]}>{timeAgo}</Text>
        {notif.status && (
          <Text style={[styles.preview, { color: mutedColor }]} numberOfLines={2}>
            {notif.status.spoiler_text || notif.status.content.replace(/<[^>]+>/g, '')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default function NotificationsScreen() {
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'
  const [refreshing, setRefreshing] = useState(false)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ['notifications'],
      queryFn: ({ pageParam }) =>
        api.notifications.list({ max_id: pageParam as string | undefined }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) =>
        lastPage.length ? lastPage[lastPage.length - 1].id : undefined,
    })

  const notifications = data?.pages.flat() ?? []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <NotifRow notif={item} />}
      onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
      onEndReachedThreshold={0.3}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8593C" />}
      ListFooterComponent={
        isFetchingNextPage
          ? <ActivityIndicator color="#E8593C" style={{ padding: 16 }} />
          : null
      }
      ListEmptyComponent={
        isLoading
          ? <ActivityIndicator color="#E8593C" style={{ marginTop: 40 }} />
          : null
      }
      style={{ backgroundColor: dark ? '#1A1A1A' : '#FFFBF8' }}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontWeight: '700', fontSize: 14 },
  label: { fontSize: 13 },
  time: { fontSize: 11, marginTop: 2 },
  preview: { fontSize: 13, marginTop: 4, lineHeight: 18 },
})
