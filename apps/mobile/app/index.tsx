import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { isAuthenticated } from '@/lib/auth'

export default function Index() {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    isAuthenticated().then((ok) => {
      setAuthed(ok)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#E8593C" size="large" />
      </View>
    )
  }

  return <Redirect href={authed ? '/(tabs)/home' : '/(auth)/login'} />
}
