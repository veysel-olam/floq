import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { registerApp, buildAuthUrl, exchangeCode } from '@/lib/auth'
import { useAuthStore } from '@/lib/store'
import { api, getServerUrl } from '@/lib/api'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const router = useRouter()
  const setAccount = useAuthStore((s) => s.setAccount)
  const setServerUrl = useAuthStore((s) => s.setServerUrl)
  const [server, setServer] = useState('floq.com')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    const serverUrl = server.startsWith('http') ? server : `https://${server}`
    setLoading(true)
    try {
      const app = await registerApp(serverUrl)
      const authUrl = buildAuthUrl(serverUrl, app)

      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'floq://oauth')

      if (result.type !== 'success') {
        setLoading(false)
        return
      }

      const url = result.url
      const code = new URL(url).searchParams.get('code')
      if (!code) {
        Alert.alert('Hata', 'Yetkilendirme kodu alınamadı.')
        setLoading(false)
        return
      }

      await exchangeCode(serverUrl, app, code)
      setServerUrl(serverUrl)

      const account = await api.accounts.verifyCredentials()
      setAccount(account)

      router.replace('/(tabs)/home')
    } catch (err) {
      Alert.alert('Giriş başarısız', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>floq</Text>
        <Text style={styles.tagline}>Flow together, own your data.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Sunucu adresi</Text>
          <TextInput
            style={styles.input}
            value={server}
            onChangeText={setServer}
            placeholder="floq.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Giriş yap"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Hesabın yok mu? floq.com'da kayıt ol.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF8' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#E8593C',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 48,
  },
  form: { gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#E8593C',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 32 },
})
