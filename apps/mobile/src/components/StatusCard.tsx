import { useState } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet, useColorScheme } from 'react-native'
import { useRouter } from 'expo-router'
import { Heart, Repeat2, MessageCircle, Bookmark } from 'lucide-react-native'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { api, type MastodonStatus } from '@/lib/api'

interface StatusCardProps {
  status: MastodonStatus
  onUpdate?: (updated: MastodonStatus) => void
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

export function StatusCard({ status, onUpdate }: StatusCardProps) {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const dark = colorScheme === 'dark'

  const displayed = status.reblog ?? status
  const isReblog = !!status.reblog

  const [faved, setFaved] = useState(displayed.favourited)
  const [favsCount, setFavsCount] = useState(displayed.favourites_count)
  const [reblogged, setReblogged] = useState(displayed.reblogged)
  const [reblogCount, setReblogCount] = useState(displayed.reblogs_count)
  const [bookmarked, setBookmarked] = useState(displayed.bookmarked)

  async function toggleFav() {
    try {
      if (faved) {
        await api.statuses.unfavourite(displayed.id)
        setFaved(false)
        setFavsCount((n) => n - 1)
      } else {
        await api.statuses.favourite(displayed.id)
        setFaved(true)
        setFavsCount((n) => n + 1)
      }
    } catch {}
  }

  async function toggleReblog() {
    try {
      if (reblogged) {
        await api.statuses.unreblog(displayed.id)
        setReblogged(false)
        setReblogCount((n) => n - 1)
      } else {
        await api.statuses.reblog(displayed.id)
        setReblogged(true)
        setReblogCount((n) => n + 1)
      }
    } catch {}
  }

  async function toggleBookmark() {
    try {
      if (bookmarked) {
        await api.statuses.unbookmark(displayed.id)
      } else {
        await api.statuses.bookmark(displayed.id)
      }
      setBookmarked((b) => !b)
    } catch {}
  }

  const textColor = dark ? '#f9fafb' : '#111827'
  const mutedColor = dark ? '#9ca3af' : '#6b7280'
  const cardBg = dark ? '#1f1f1f' : '#ffffff'
  const borderColor = dark ? '#2a2a2a' : '#f3f4f6'

  const timeAgo = formatDistanceToNow(new Date(displayed.created_at), { addSuffix: true, locale: tr })

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderBottomColor: borderColor }]}
      onPress={() => router.push(`/status/${displayed.id}`)}
      activeOpacity={0.8}
    >
      {isReblog && (
        <View style={styles.reblogRow}>
          <Repeat2 size={12} color={mutedColor} />
          <Text style={[styles.reblogText, { color: mutedColor }]}>
            {status.account.display_name || status.account.username} boost'ladı
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push(`/profile/${displayed.account.acct}`)}>
          <Image source={{ uri: displayed.account.avatar }} style={styles.avatar} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <TouchableOpacity onPress={() => router.push(`/profile/${displayed.account.acct}`)}>
            <Text style={[styles.displayName, { color: textColor }]} numberOfLines={1}>
              {displayed.account.display_name || displayed.account.username}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.handle, { color: mutedColor }]} numberOfLines={1}>
            @{displayed.account.acct} · {timeAgo}
          </Text>
        </View>
      </View>

      {displayed.spoiler_text ? (
        <View style={styles.cwBadge}>
          <Text style={styles.cwText}>{displayed.spoiler_text}</Text>
        </View>
      ) : null}

      <Text style={[styles.content, { color: textColor }]}>
        {stripHtml(displayed.content)}
      </Text>

      {displayed.media_attachments.length > 0 && (
        <View style={styles.mediaGrid}>
          {displayed.media_attachments.slice(0, 4).map((att) => (
            <Image
              key={att.id}
              source={{ uri: att.preview_url || att.url }}
              style={[
                styles.mediaItem,
                displayed.media_attachments.length === 1 && styles.mediaFull,
              ]}
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => router.push(`/status/${displayed.id}`)}>
          <MessageCircle size={16} color={mutedColor} />
          {displayed.replies_count > 0 && (
            <Text style={[styles.actionCount, { color: mutedColor }]}>{displayed.replies_count}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={toggleReblog}>
          <Repeat2 size={16} color={reblogged ? '#22c55e' : mutedColor} />
          {reblogCount > 0 && (
            <Text style={[styles.actionCount, { color: reblogged ? '#22c55e' : mutedColor }]}>{reblogCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={toggleFav}>
          <Heart size={16} color={faved ? '#E8593C' : mutedColor} fill={faved ? '#E8593C' : 'none'} />
          {favsCount > 0 && (
            <Text style={[styles.actionCount, { color: faved ? '#E8593C' : mutedColor }]}>{favsCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={toggleBookmark}>
          <Bookmark size={16} color={bookmarked ? '#E8593C' : mutedColor} fill={bookmarked ? '#E8593C' : 'none'} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  reblogRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  reblogText: { fontSize: 12 },
  header: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb' },
  headerText: { flex: 1, justifyContent: 'center' },
  displayName: { fontWeight: '700', fontSize: 14 },
  handle: { fontSize: 12, marginTop: 1 },
  cwBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  cwText: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  content: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8, borderRadius: 8, overflow: 'hidden' },
  mediaItem: { width: '48%', height: 120, borderRadius: 6 },
  mediaFull: { width: '100%', height: 220 },
  actions: { flexDirection: 'row', gap: 20, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 13 },
})
