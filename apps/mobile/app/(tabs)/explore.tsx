import { useState, useCallback } from 'react'
import {
  View,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  Text,
  TouchableOpacity,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api, type MastodonStatus } from '@/lib/api'
import { StatusCard } from '@/components/StatusCard'
import { Search } from 'lucide-react-native'

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useState(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  })
  return debounced
}

export default function ExploreScreen() {
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 400)

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.search.query(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  })

  const { data: publicTimeline, isLoading: loadingPublic } = useQuery({
    queryKey: ['timeline', 'public', 'local'],
    queryFn: () => api.timelines.public({ local: true }),
    enabled: debouncedQuery.length < 2,
  })

  const textColor = dark ? '#f9fafb' : '#111827'
  const mutedColor = dark ? '#9ca3af' : '#6b7280'
  const inputBg = dark ? '#2a2a2a' : '#f3f4f6'
  const bg = dark ? '#1A1A1A' : '#FFFBF8'

  const showSearch = debouncedQuery.length >= 2
  const statuses: MastodonStatus[] = showSearch
    ? (searchResults?.statuses ?? [])
    : (publicTimeline ?? [])

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={[styles.searchBar, { backgroundColor: bg }]}>
        <View style={[styles.inputWrapper, { backgroundColor: inputBg }]}>
          <Search size={16} color={mutedColor} />
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Ara..."
            placeholderTextColor={mutedColor}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      {(searching || loadingPublic) && !statuses.length ? (
        <ActivityIndicator color="#E8593C" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={statuses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <StatusCard status={item} />}
          ListEmptyComponent={
            showSearch ? (
              <Text style={[styles.empty, { color: mutedColor }]}>Sonuç bulunamadı</Text>
            ) : null
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  searchBar: { paddingHorizontal: 16, paddingVertical: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
})
