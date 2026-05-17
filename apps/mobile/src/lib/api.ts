import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'floq_access_token'
const SERVER_KEY = 'floq_server_url'

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function getServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(SERVER_KEY)
}

export async function saveAuth(serverUrl: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_KEY, serverUrl)
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function clearAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(SERVER_KEY)
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const [serverUrl, token] = await Promise.all([getServerUrl(), getToken()])
  if (!serverUrl) throw new Error('Not configured')

  const res = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }

  return res.json() as T
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MastodonAccount {
  id: string
  username: string
  acct: string
  display_name: string
  note: string
  url: string
  avatar: string
  header: string
  followers_count: number
  following_count: number
  statuses_count: number
  locked: boolean
  bot: boolean
  group: boolean
  created_at: string
  emojis: MastodonEmoji[]
  fields: { name: string; value: string; verified_at: string | null }[]
}

export interface MastodonStatus {
  id: string
  created_at: string
  in_reply_to_id: string | null
  in_reply_to_account_id: string | null
  sensitive: boolean
  spoiler_text: string
  visibility: 'public' | 'unlisted' | 'private' | 'direct'
  language: string | null
  uri: string
  url: string
  replies_count: number
  reblogs_count: number
  favourites_count: number
  favourited: boolean
  reblogged: boolean
  bookmarked: boolean
  content: string
  reblog: MastodonStatus | null
  account: MastodonAccount
  media_attachments: MastodonAttachment[]
  mentions: { id: string; username: string; acct: string; url: string }[]
  tags: { name: string; url: string }[]
  emojis: MastodonEmoji[]
}

export interface MastodonAttachment {
  id: string
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown'
  url: string
  preview_url: string
  description: string | null
  blurhash: string | null
}

export interface MastodonEmoji {
  shortcode: string
  url: string
  static_url: string
  visible_in_picker: boolean
}

export interface MastodonNotification {
  id: string
  type: 'mention' | 'reblog' | 'favourite' | 'follow' | 'follow_request' | 'poll' | 'update'
  created_at: string
  account: MastodonAccount
  status?: MastodonStatus
}

// ─── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  accounts: {
    verifyCredentials: () => request<MastodonAccount>('/api/v1/accounts/verify_credentials'),
    get: (id: string) => request<MastodonAccount>(`/api/v1/accounts/${id}`),
    statuses: (id: string, params?: { max_id?: string; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.max_id) qs.set('max_id', params.max_id)
      if (params?.limit) qs.set('limit', String(params.limit))
      return request<MastodonStatus[]>(`/api/v1/accounts/${id}/statuses?${qs}`)
    },
    follow: (id: string) => request<{ following: boolean }>(`/api/v1/accounts/${id}/follow`, { method: 'POST' }),
    unfollow: (id: string) => request<{ following: boolean }>(`/api/v1/accounts/${id}/unfollow`, { method: 'POST' }),
    followers: (id: string, params?: { max_id?: string }) => {
      const qs = params?.max_id ? `?max_id=${params.max_id}` : ''
      return request<MastodonAccount[]>(`/api/v1/accounts/${id}/followers${qs}`)
    },
    following: (id: string, params?: { max_id?: string }) => {
      const qs = params?.max_id ? `?max_id=${params.max_id}` : ''
      return request<MastodonAccount[]>(`/api/v1/accounts/${id}/following${qs}`)
    },
    search: (q: string) => request<MastodonAccount[]>(`/api/v1/accounts/search?q=${encodeURIComponent(q)}&limit=20`),
  },

  timelines: {
    home: (params?: { max_id?: string; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.max_id) qs.set('max_id', params.max_id)
      qs.set('limit', String(params?.limit ?? 20))
      return request<MastodonStatus[]>(`/api/v1/timelines/home?${qs}`)
    },
    public: (params?: { max_id?: string; local?: boolean }) => {
      const qs = new URLSearchParams()
      if (params?.max_id) qs.set('max_id', params.max_id)
      if (params?.local) qs.set('local', 'true')
      return request<MastodonStatus[]>(`/api/v1/timelines/public?${qs}`)
    },
    tag: (hashtag: string, params?: { max_id?: string }) => {
      const qs = params?.max_id ? `?max_id=${params.max_id}` : ''
      return request<MastodonStatus[]>(`/api/v1/timelines/tag/${encodeURIComponent(hashtag)}${qs}`)
    },
  },

  statuses: {
    get: (id: string) => request<MastodonStatus>(`/api/v1/statuses/${id}`),
    create: (body: {
      status: string
      in_reply_to_id?: string
      media_ids?: string[]
      sensitive?: boolean
      spoiler_text?: string
      visibility?: string
    }) => request<MastodonStatus>('/api/v1/statuses', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => request<MastodonStatus>(`/api/v1/statuses/${id}`, { method: 'DELETE' }),
    favourite: (id: string) => request<MastodonStatus>(`/api/v1/statuses/${id}/favourite`, { method: 'POST' }),
    unfavourite: (id: string) => request<MastodonStatus>(`/api/v1/statuses/${id}/unfavourite`, { method: 'POST' }),
    reblog: (id: string) => request<MastodonStatus>(`/api/v1/statuses/${id}/reblog`, { method: 'POST' }),
    unreblog: (id: string) => request<MastodonStatus>(`/api/v1/statuses/${id}/unreblog`, { method: 'POST' }),
    bookmark: (id: string) => request<MastodonStatus>(`/api/v1/statuses/${id}/bookmark`, { method: 'POST' }),
    unbookmark: (id: string) => request<MastodonStatus>(`/api/v1/statuses/${id}/unbookmark`, { method: 'POST' }),
    context: (id: string) => request<{ ancestors: MastodonStatus[]; descendants: MastodonStatus[] }>(`/api/v1/statuses/${id}/context`),
  },

  notifications: {
    list: (params?: { max_id?: string; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.max_id) qs.set('max_id', params.max_id)
      qs.set('limit', String(params?.limit ?? 20))
      return request<MastodonNotification[]>(`/api/v1/notifications?${qs}`)
    },
    clear: () => request<Record<string, never>>('/api/v1/notifications/clear', { method: 'POST' }),
    dismiss: (id: string) => request<Record<string, never>>(`/api/v1/notifications/${id}/dismiss`, { method: 'POST' }),
  },

  search: {
    query: (q: string, type?: 'accounts' | 'statuses' | 'hashtags') => {
      const qs = new URLSearchParams({ q, resolve: 'true' })
      if (type) qs.set('type', type)
      return request<{
        accounts: MastodonAccount[]
        statuses: MastodonStatus[]
        hashtags: { name: string; url: string; history: unknown[] }[]
      }>(`/api/v2/search?${qs}`)
    },
  },

  instance: {
    get: () => request<{ title: string; description: string; uri: string; version: string }>('/api/v1/instance'),
  },

  push: {
    subscribe: (params: {
      endpoint: string
      keys: { p256dh: string; auth: string }
      alerts?: Record<string, boolean>
    }) =>
      request('/api/v1/push/subscription', {
        method: 'POST',
        body: JSON.stringify({
          subscription: { endpoint: params.endpoint, keys: params.keys },
          data: { alerts: params.alerts ?? { follow: true, favourite: true, reblog: true, mention: true } },
        }),
      }),
    delete: () => request('/api/v1/push/subscription', { method: 'DELETE' }),
  },
}
