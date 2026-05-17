import { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const MAX_CHARS = 500

export default function ComposeScreen() {
  const router = useRouter()
  const { reply_to } = useLocalSearchParams<{ reply_to?: string }>()
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'
  const queryClient = useQueryClient()

  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)

  const { data: account } = useQuery({ queryKey: ['me'], queryFn: api.accounts.verifyCredentials })

  const remaining = MAX_CHARS - content.length
  const overLimit = remaining < 0

  const textColor = dark ? '#f9fafb' : '#111827'
  const mutedColor = dark ? '#9ca3af' : '#6b7280'
  const bg = dark ? '#1A1A1A' : '#FFFBF8'
  const borderColor = dark ? '#2a2a2a' : '#f3f4f6'

  async function handlePost() {
    if (!content.trim() || overLimit) return
    setPosting(true)
    try {
      await api.statuses.create({
        status: content.trim(),
        in_reply_to_id: reply_to ?? undefined,
      })
      await queryClient.invalidateQueries({ queryKey: ['timeline', 'home'] })
      router.back()
    } catch (err) {
      Alert.alert('Gönderi başarısız', (err as Error).message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.toolbar, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.toolbarBtn}>
          <Text style={{ color: '#E8593C', fontSize: 15 }}>İptal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.postBtn, (overLimit || !content.trim() || posting) && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={overLimit || !content.trim() || posting}
        >
          {posting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.postBtnText}>Paylaş</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.compose}>
        {account && (
          <Image source={{ uri: account.avatar }} style={styles.avatar} />
        )}
        <View style={{ flex: 1 }}>
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Ne düşünüyorsun?"
            placeholderTextColor={mutedColor}
            multiline
            autoFocus
            value={content}
            onChangeText={setContent}
            maxLength={MAX_CHARS + 100}
          />
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: borderColor }]}>
        <Text style={[styles.charCount, { color: overLimit ? '#ef4444' : mutedColor }]}>
          {remaining}
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolbarBtn: { padding: 4 },
  postBtn: {
    backgroundColor: '#E8593C',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  compose: { flex: 1, flexDirection: 'row', padding: 16, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb' },
  input: { fontSize: 16, lineHeight: 24, flex: 1 },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'flex-end' },
  charCount: { fontSize: 13, fontWeight: '600' },
})
