import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react-native'
import { api } from '@/lib/api'
import { StatusCard } from '@/components/StatusCard'

export default function StatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'
  const mutedColor = dark ? '#9ca3af' : '#6b7280'
  const bg = dark ? '#1A1A1A' : '#FFFBF8'

  const { data, isLoading } = useQuery({
    queryKey: ['status', id],
    queryFn: async () => {
      const [status, context] = await Promise.all([
        api.statuses.get(id!),
        api.statuses.context(id!),
      ])
      return { status, context }
    },
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator color="#E8593C" />
      </View>
    )
  }

  if (!data) return null

  const { status, context } = data

  return (
    <ScrollView style={{ backgroundColor: bg }}>
      {context.ancestors.map((s) => (
        <StatusCard key={s.id} status={s} />
      ))}

      <View style={[styles.focusCard, { borderColor: '#E8593C' }]}>
        <StatusCard status={status} />
      </View>

      <TouchableOpacity
        style={[styles.replyBtn, { borderColor: mutedColor }]}
        onPress={() => router.push({ pathname: '/compose', params: { reply_to: status.id } })}
      >
        <MessageCircle size={14} color={mutedColor} />
        <Text style={[styles.replyText, { color: mutedColor }]}>Yanıtla</Text>
      </TouchableOpacity>

      {context.descendants.map((s) => (
        <StatusCard key={s.id} status={s} />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  focusCard: { borderLeftWidth: 3 },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  replyText: { fontSize: 13 },
})
