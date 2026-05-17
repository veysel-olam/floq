import { useCallback, useState } from 'react'
import {
  FlatList,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react-native'
import { api, type MastodonStatus } from '@/lib/api'
import { StatusCard } from '@/components/StatusCard'

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'
  const [refreshing, setRefreshing] = useState(false)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ['timeline', 'home'],
      queryFn: ({ pageParam }) => api.timelines.home({ max_id: pageParam as string | undefined }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => {
        if (!lastPage.length) return undefined
        return lastPage[lastPage.length - 1].id
      },
    })

  const statuses = data?.pages.flat() ?? []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={statuses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <StatusCard status={item} />}
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
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#E8593C' }]}
        onPress={() => router.push('/compose')}
        accessibilityRole="button"
        accessibilityLabel="Yeni gönderi"
      >
        <Pencil size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
})
