'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Loader2, Plus, Trash2, GripVertical, X, Check,
  Settings, LayoutTemplate, BookOpen, History, ShieldAlert, Award, Tag, Handshake, Vote,
} from 'lucide-react'
import { api, type Community, type PostTemplate, type PostTemplateField, type ModlogEntry, type CommunityType, type CommunityFlair, type Partnership } from '@/lib/api'
import { communityGradient } from '@/lib/community-colors'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Helpers ─────────────────────────────────────────────────────────────────

function newField(): PostTemplateField {
  return { key: `field_${Date.now()}`, label: '', type: 'text', required: false }
}

function newTemplate(): PostTemplate {
  return { id: `tpl_${Date.now()}`, name: '', icon: '📝', fields: [newField()] }
}

// ── Field editor ─────────────────────────────────────────────────────────────

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: PostTemplateField
  onChange: (f: PostTemplateField) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-background) p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-(--color-text-tertiary) flex-shrink-0" />
        <input
          type="text"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || field.key })}
          placeholder="Alan adı (örn. Kamera)"
          className="flex-1 text-[13px] bg-(--color-background-secondary) rounded-lg px-2.5 py-1.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-1 focus:ring-(--color-coral)"
        />
        <button onClick={onRemove} className="p-1 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 pl-6">
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as PostTemplateField['type'] })}
          className="text-[12px] bg-(--color-background-secondary) border border-(--color-border) rounded-lg px-2 py-1.5 text-(--color-text-secondary) focus:outline-none focus:ring-1 focus:ring-(--color-coral)"
        >
          <option value="text">Kısa metin</option>
          <option value="textarea">Uzun metin</option>
          <option value="select">Seçenek</option>
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-(--color-text-tertiary) cursor-pointer">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="rounded"
          />
          Zorunlu
        </label>
      </div>
      {field.type === 'select' && (
        <div className="pl-6">
          <input
            type="text"
            value={field.options?.join(', ') ?? ''}
            onChange={(e) => onChange({ ...field, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder="Seçenekler: A, B, C (virgülle ayır)"
            className="w-full text-[12px] bg-(--color-background-secondary) rounded-lg px-2.5 py-1.5 text-(--color-text-secondary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-1 focus:ring-(--color-coral)"
          />
        </div>
      )}
    </div>
  )
}

// ── Template editor ───────────────────────────────────────────────────────────

function TemplateEditor({
  template,
  onChange,
  onRemove,
}: {
  template: PostTemplate
  onChange: (t: PostTemplate) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-background-secondary) p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={template.icon}
          onChange={(e) => onChange({ ...template, icon: e.target.value })}
          maxLength={2}
          className="w-10 text-center text-lg bg-(--color-background) border border-(--color-border) rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-(--color-coral)"
        />
        <input
          type="text"
          value={template.name}
          onChange={(e) => onChange({ ...template, name: e.target.value })}
          placeholder="Şablon adı (örn. Film İzlenimi)"
          className="flex-1 text-[14px] font-medium bg-(--color-background) border border-(--color-border) rounded-lg px-3 py-1.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-1 focus:ring-(--color-coral)"
        />
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {template.fields.map((field, i) => (
          <FieldEditor
            key={field.key + i}
            field={field}
            onChange={(f) => onChange({
              ...template,
              fields: template.fields.map((ff, fi) => fi === i ? f : ff),
            })}
            onRemove={() => onChange({
              ...template,
              fields: template.fields.filter((_, fi) => fi !== i),
            })}
          />
        ))}
      </div>

      {template.fields.length < 10 && (
        <button
          onClick={() => onChange({ ...template, fields: [...template.fields, newField()] })}
          className="flex items-center gap-1.5 text-[12px] text-(--color-coral) font-medium hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          Alan ekle
        </button>
      )}
    </div>
  )
}

// ── General settings section ──────────────────────────────────────────────────

const COMMUNITY_TYPES: { value: CommunityType; label: string; emoji: string; description: string }[] = [
  { value: 'general',  label: 'Genel',     emoji: '💬', description: 'Her türlü konu için genel bir topluluk' },
  { value: 'project',  label: 'Proje',     emoji: '🛠️', description: 'Yazılım, araştırma veya ortak proje' },
  { value: 'event',    label: 'Etkinlik',  emoji: '📅', description: 'Etkinlik, buluşma veya duyuru odaklı' },
  { value: 'support',  label: 'Destek',    emoji: '🤝', description: 'Soru-cevap ve yardımlaşma' },
  { value: 'learning', label: 'Öğrenme',   emoji: '📚', description: 'Eğitim, kurs veya kaynak paylaşımı' },
  { value: 'gaming',   label: 'Oyun',      emoji: '🎮', description: 'Oyun topluluğu' },
  { value: 'creative', label: 'Yaratıcı',  emoji: '🎨', description: 'Sanat, müzik, tasarım ve yaratıcılık' },
]

function GeneralSettings({ community, onSave }: { community: Community; onSave: (c: Community) => void }) {
  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description ?? '')
  const [rules, setRules] = useState(community.rules ?? '')
  const [topics, setTopics] = useState(community.topics ?? '')
  const [visibility, setVisibility] = useState(community.visibility)
  const [communityType, setCommunityType] = useState<CommunityType>(community.community_type)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const updated = await api.communities.update(community.handle, {
        name: name.trim(),
        description: description.trim() || undefined,
        rules: rules.trim() || undefined,
        topics: topics.trim() || undefined,
        visibility,
        community_type: communityType,
      })
      onSave(updated)
      toast.success('Ayarlar kaydedildi.')
    } catch { toast.error('Kaydedilemedi.') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest block mb-1.5">Topluluk Adı</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest block mb-1.5">Açıklama</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) resize-none focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest block mb-1.5">Görünürlük</label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Community['visibility'])}
          className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
        >
          <option value="public">Açık — herkes katılabilir</option>
          <option value="restricted">Kısıtlı — katılmak için onay gerekir</option>
          <option value="private">Gizli — yalnızca davetliler görebilir</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest block mb-2">Topluluk Tipi</label>
        <div className="grid grid-cols-2 gap-2">
          {COMMUNITY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setCommunityType(t.value)}
              className={cn(
                'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                communityType === t.value
                  ? 'border-(--color-coral) bg-(--color-coral)/5 ring-1 ring-(--color-coral)'
                  : 'border-(--color-border) hover:border-(--color-border-strong)',
              )}
            >
              <span className="text-lg leading-none mt-0.5">{t.emoji}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-(--color-text-primary) leading-tight">{t.label}</p>
                <p className="text-[11px] text-(--color-text-tertiary) leading-snug mt-0.5 line-clamp-2">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest block mb-1.5">Kurallar</label>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          rows={4}
          placeholder="Her satır bir kural olarak gösterilir."
          className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) resize-none placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest block mb-1.5">Konular</label>
        <input
          type="text"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="fotoğrafçılık, doğa, teknik (virgülle ayır)"
          className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
        />
      </div>
      <button
        onClick={save}
        disabled={saving || !name.trim()}
        className="flex items-center gap-1.5 text-sm px-5 py-2.5 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        Kaydet
      </button>
    </div>
  )
}

// ── Templates section ─────────────────────────────────────────────────────────

function TemplatesSettings({ community, onSave }: { community: Community; onSave: (c: Community) => void }) {
  const [templates, setTemplates] = useState<PostTemplate[]>(community.post_templates ?? [])
  const [saving, setSaving] = useState(false)

  async function save() {
    const valid = templates.every((t) => t.name.trim() && t.fields.every((f) => f.label.trim()))
    if (!valid) { toast.error('Tüm şablon ve alan adlarını doldurun.'); return }

    setSaving(true)
    try {
      const updated = await api.communities.update(community.handle, {
        post_templates: templates.length > 0 ? templates : null,
      })
      onSave(updated)
      toast.success('Şablonlar kaydedildi.')
    } catch { toast.error('Kaydedilemedi.') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--color-text-secondary) leading-relaxed">
        Şablonlar, üyelerin yapılandırılmış gönderiler oluşturmasını sağlar. En fazla 5 şablon tanımlayabilirsin.
      </p>

      {templates.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-dashed border-(--color-border)">
          <LayoutTemplate className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-2" />
          <p className="text-sm text-(--color-text-tertiary)">Henüz şablon yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl, i) => (
            <TemplateEditor
              key={tpl.id}
              template={tpl}
              onChange={(t) => setTemplates((prev) => prev.map((tt, ti) => ti === i ? t : tt))}
              onRemove={() => setTemplates((prev) => prev.filter((_, ti) => ti !== i))}
            />
          ))}
        </div>
      )}

      {templates.length < 5 && (
        <button
          onClick={() => setTemplates((prev) => [...prev, newTemplate()])}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-full border border-dashed border-(--color-coral)/40 text-(--color-coral) hover:bg-(--color-coral)/5 transition-colors font-medium w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Şablon ekle
        </button>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1.5 text-sm px-5 py-2.5 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        Kaydet
      </button>
    </div>
  )
}

// ── Wiki section ─────────────────────────────────────────────────────────────

function WikiSettings({ community }: { community: Community }) {
  const [content, setContent] = useState('')
  const [currentVersion, setCurrentVersion] = useState(0)
  const [editedBy, setEditedBy] = useState<{ handle: string; displayName: string | null } | null>(null)
  const [editedAt, setEditedAt] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ version: number; editedAt: string; editedBy: { handle: string; displayName: string | null }; contentPreview: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    api.communities.wiki(community.handle)
      .then((data) => {
        setContent(data.content)
        setCurrentVersion(data.version)
        setEditedBy(data.editedBy)
        setEditedAt(data.editedAt)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [community.handle])

  async function save() {
    setSaving(true)
    try {
      const result = await api.communities.updateWiki(community.handle, content)
      setCurrentVersion(result.version)
      setEditedBy(result.editedBy)
      setEditedAt(result.editedAt)
      toast.success('Wiki kaydedildi.')
    } catch { toast.error('Kaydedilemedi.') }
    finally { setSaving(false) }
  }

  async function loadHistory() {
    try {
      const rows = await api.communities.wikiHistory(community.handle)
      setHistory(rows)
      setShowHistory(true)
    } catch { toast.error('Geçmiş yüklenemedi.') }
  }

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" /></div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--color-text-secondary) leading-relaxed">
        Wiki, topluluğun kalıcı bilgi sayfasıdır. Kurallar, kaynaklar, sık sorulan sorular eklenebilir. Her kayıt yeni bir sürüm oluşturur.
      </p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={16}
        placeholder="Topluluk hakkında bilgi, kaynaklar, SSS..."
        className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) resize-y focus:outline-none focus:ring-2 focus:ring-(--color-coral) font-mono leading-relaxed"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm px-5 py-2.5 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Kaydet
          </button>
          {currentVersion > 0 && (
            <button
              onClick={showHistory ? () => setShowHistory(false) : loadHistory}
              className="flex items-center gap-1.5 text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
            >
              <History className="w-4 h-4" />
              Geçmiş {showHistory ? '↑' : '↓'}
            </button>
          )}
        </div>
        {editedBy && editedAt && (
          <p className="text-[11px] text-(--color-text-tertiary)">
            v{currentVersion} · @{editedBy.handle} · {new Date(editedAt).toLocaleDateString('tr')}
          </p>
        )}
      </div>

      {showHistory && history.length > 0 && (
        <div className="rounded-xl border border-(--color-border) overflow-hidden">
          <div className="px-3 py-2 border-b border-(--color-border-secondary) flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-(--color-coral)" />
            <span className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-wide">Düzenleme Geçmişi</span>
          </div>
          <div className="divide-y divide-(--color-border-secondary)">
            {history.map((row) => (
              <div key={row.version} className="px-3 py-2.5 flex items-start gap-3">
                <span className="text-xs font-mono text-(--color-coral) w-6 flex-shrink-0">v{row.version}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-(--color-text-tertiary) line-clamp-1">{row.contentPreview || '(boş)'}</p>
                  <p className="text-[11px] text-(--color-text-tertiary) mt-0.5">
                    @{row.editedBy.handle} · {new Date(row.editedAt).toLocaleDateString('tr')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  coral:  'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900',
  teal:   'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900',
  blue:   'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900',
  purple: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900',
  green:  'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900',
  orange: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900',
  red:    'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
}

const BADGE_COLOR_OPTIONS = ['coral', 'teal', 'blue', 'purple', 'green', 'orange', 'red'] as const

function BadgesSettings({ community }: { community: Community }) {
  const [badges, setBadges] = useState<import('@/lib/api').CommunityBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '🏅', description: '', color: 'coral' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.communities.badges(community.handle)
      .then(setBadges)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [community.handle])

  async function create() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const badge = await api.communities.createBadge(community.handle, {
        name: form.name.trim(),
        icon: form.icon.trim() || '🏅',
        description: form.description.trim() || undefined,
        color: form.color,
      })
      setBadges((prev) => [...prev, badge])
      setForm({ name: '', icon: '🏅', description: '', color: 'coral' })
      setCreating(false)
    } catch { toast.error('Rozet oluşturulamadı.') }
    finally { setSaving(false) }
  }

  async function remove(badgeId: string) {
    try {
      await api.communities.deleteBadge(community.handle, badgeId)
      setBadges((prev) => prev.filter((b) => b.id !== badgeId))
    } catch { toast.error('Silinemedi.') }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" /></div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--color-text-secondary) leading-relaxed">
        Moderatörler olarak üyelere özel rozetler verebilirsin. En fazla 20 rozet tanımlanabilir.
      </p>

      {badges.length === 0 && !creating ? (
        <div className="py-10 text-center rounded-2xl border border-dashed border-(--color-border)">
          <span className="text-3xl">🏅</span>
          <p className="text-sm text-(--color-text-tertiary) mt-2">Henüz rozet yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {badges.map((badge) => (
            <div key={badge.id} className="flex items-center gap-3 rounded-xl border border-(--color-border) px-3 py-2.5">
              <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full border', BADGE_COLORS[badge.color] ?? BADGE_COLORS.coral)}>
                {badge.icon} {badge.name}
              </span>
              {badge.description && <p className="text-[12px] text-(--color-text-tertiary) flex-1 truncate">{badge.description}</p>}
              <button
                onClick={() => remove(badge.id)}
                className="ml-auto p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {creating ? (
        <div className="rounded-xl border border-(--color-border) p-4 space-y-3">
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest">Yeni Rozet</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="🏅"
              className="w-14 text-center text-lg bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
            />
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Rozet adı"
              className="flex-1 text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
            />
          </div>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Açıklama (isteğe bağlı)"
            className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
          />
          <div className="flex gap-2 flex-wrap">
            {BADGE_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all', BADGE_COLORS[c], form.color === c && 'ring-2 ring-offset-1 ring-current')}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={saving || !form.name.trim()} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Oluştur
            </button>
            <button onClick={() => setCreating(false)} className="text-sm px-4 py-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors">
              İptal
            </button>
          </div>
        </div>
      ) : (
        badges.length < 20 && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-full border border-dashed border-(--color-border) text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:border-(--color-border-strong) transition-colors w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            Rozet Ekle
          </button>
        )
      )}
    </div>
  )
}

// ── Modlog ────────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  ban: 'Banlandı',
  unban: 'Ban kaldırıldı',
  remove_post: 'Gönderi silindi',
  pin_post: 'Gönderi sabitlendi',
  unpin_post: 'Sabitleme kaldırıldı',
  approve_member: 'Üye onaylandı',
  reject_member: 'Üyelik reddedildi',
  edit_wiki: 'Wiki düzenlendi',
  update_settings: 'Ayarlar güncellendi',
  invite_generated: 'Davet linki oluşturuldu',
  invite_revoked: 'Davet linki iptal edildi',
  add_mod: 'Moderatör eklendi',
  remove_mod: 'Moderatör kaldırıldı',
}

const ACTION_COLORS: Record<string, string> = {
  ban: 'text-red-500',
  unban: 'text-green-500',
  remove_post: 'text-red-400',
  pin_post: 'text-blue-400',
  unpin_post: 'text-(--color-text-tertiary)',
  approve_member: 'text-green-500',
  reject_member: 'text-orange-500',
  edit_wiki: 'text-purple-400',
  update_settings: 'text-(--color-coral)',
  invite_generated: 'text-teal-400',
  invite_revoked: 'text-orange-400',
  add_mod: 'text-blue-500',
  remove_mod: 'text-orange-500',
}

function ModlogSettings({ community }: { community: Community }) {
  const [entries, setEntries] = useState<ModlogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.communities.modlog(community.handle)
      .then((data) => setEntries(data.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [community.handle])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <ShieldAlert className="w-8 h-8 text-(--color-text-tertiary)" />
        <p className="text-sm text-(--color-text-tertiary)">Henüz moderasyon işlemi yok.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-(--color-border) overflow-hidden">
      <div className="divide-y divide-(--color-border-secondary)">
        {entries.map((entry) => (
          <div key={entry.id} className="px-3.5 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[12px] font-semibold ${ACTION_COLORS[entry.action] ?? 'text-(--color-text-primary)'}`}>
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                {entry.targetUser && (
                  <span className="text-[12px] text-(--color-text-secondary)">→ @{entry.targetUser.handle}</span>
                )}
                {entry.reason && (
                  <span className="text-[12px] text-(--color-text-tertiary) italic truncate max-w-[180px]">"{entry.reason}"</span>
                )}
              </div>
              <p className="text-[11px] text-(--color-text-tertiary) mt-0.5">
                @{entry.actor.handle} · {new Date(entry.createdAt).toLocaleString('tr')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Flairs ───────────────────────────────────────────────────────────────────

const FLAIR_COLOR_OPTIONS = ['coral', 'teal', 'blue', 'purple', 'green', 'orange', 'red'] as const

function FlairsSettings({ community }: { community: Community }) {
  const [flairs, setFlairs] = useState<CommunityFlair[]>(community.flairs)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '', color: 'coral' })
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const flair = await api.communities.createFlair(community.handle, {
        name: form.name.trim(),
        emoji: form.emoji.trim() || undefined,
        color: form.color,
      })
      setFlairs((prev) => [...prev, flair])
      setForm({ name: '', emoji: '', color: 'coral' })
      setCreating(false)
    } catch { toast.error('Flair oluşturulamadı.') }
    finally { setSaving(false) }
  }

  async function remove(flairId: string) {
    try {
      await api.communities.deleteFlair(community.handle, flairId)
      setFlairs((prev) => prev.filter((f) => f.id !== flairId))
    } catch { toast.error('Silinemedi.') }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--color-text-secondary) leading-relaxed">
        Flair etiketleri, üyelerin paylaşımlarını kategorilere göre işaretlemesini sağlar. En fazla 15 flair eklenebilir.
      </p>

      {flairs.length === 0 && !creating ? (
        <div className="py-10 text-center rounded-2xl border border-dashed border-(--color-border)">
          <span className="text-3xl">🏷️</span>
          <p className="text-sm text-(--color-text-tertiary) mt-2">Henüz flair yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flairs.map((flair) => (
            <div key={flair.id} className="flex items-center gap-3 rounded-xl border border-(--color-border) px-3 py-2.5">
              <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full border', BADGE_COLORS[flair.color] ?? BADGE_COLORS.coral)}>
                {flair.emoji && <span>{flair.emoji}</span>}
                {flair.name}
              </span>
              <button
                onClick={() => remove(flair.id)}
                className="ml-auto p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {creating ? (
        <div className="rounded-xl border border-(--color-border) p-4 space-y-3">
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest">Yeni Flair</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              placeholder="🏷️"
              className="w-14 text-center text-lg bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
            />
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Flair adı (örn. Soru, Duyuru)"
              className="flex-1 text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {FLAIR_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all', BADGE_COLORS[c], form.color === c && 'ring-2 ring-offset-1 ring-current')}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Oluştur
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-sm px-4 py-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        flairs.length < 15 && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-full border border-dashed border-(--color-border) text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:border-(--color-border-strong) transition-colors w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            Flair Ekle
          </button>
        )
      )}
    </div>
  )
}

// ── Partnerships ─────────────────────────────────────────────────────────────

function PartnershipsSettings({ community }: { community: Community }) {
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [loading, setLoading] = useState(true)
  const [proposing, setProposing] = useState(false)
  const [targetHandle, setTargetHandle] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.communities.partnerships(community.handle)
      .then(setPartnerships)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [community.handle])

  async function propose() {
    if (!targetHandle.trim()) return
    setSaving(true)
    try {
      await api.communities.proposePartnership(community.handle, targetHandle.trim())
      const updated = await api.communities.partnerships(community.handle)
      setPartnerships(updated)
      setTargetHandle('')
      setProposing(false)
      toast.success('İttifak teklifi gönderildi.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Teklif gönderilemedi.')
    } finally { setSaving(false) }
  }

  async function respond(partnershipId: string, action: 'accept' | 'reject') {
    try {
      await api.communities.respondPartnership(community.handle, partnershipId, action)
      setPartnerships((prev) =>
        prev.map((p) => p.id === partnershipId ? { ...p, status: action === 'accept' ? 'active' : 'rejected' } : p)
      )
      toast.success(action === 'accept' ? 'İttifak kabul edildi.' : 'İstek reddedildi.')
    } catch { toast.error('İşlem başarısız.') }
  }

  async function dissolve(partnershipId: string) {
    try {
      await api.communities.dissolvePartnership(community.handle, partnershipId)
      setPartnerships((prev) => prev.filter((p) => p.id !== partnershipId))
      toast.success('İttifak çözüldü.')
    } catch { toast.error('Çözülemedi.') }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" /></div>

  const active = partnerships.filter((p) => p.status === 'active')
  const incoming = partnerships.filter((p) => p.status === 'pending' && p.direction === 'incoming')
  const outgoing = partnerships.filter((p) => p.status === 'pending' && p.direction === 'outgoing')

  return (
    <div className="space-y-5">
      <p className="text-sm text-(--color-text-secondary) leading-relaxed">
        Müttefik topluluklar birbirinin sayfasında listelenir. Gönüllü, eşit ortaklık — her iki taraf da kabul etmeli.
      </p>

      {/* Aktif ittifaklar */}
      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2">Aktif İttifaklar</p>
          <div className="space-y-2">
            {active.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-(--color-border) px-3 py-2.5">
                <Handshake className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-(--color-text-primary) truncate">
                    {p.partner?.displayName ?? p.partner?.handle ?? '—'}
                  </p>
                  <p className="text-[11px] text-(--color-text-tertiary)">@{p.partner?.handle}</p>
                </div>
                <button
                  onClick={() => dissolve(p.id)}
                  className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
                  title="İttifakı çöz"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gelen teklifler */}
      {incoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2">Gelen Teklifler</p>
          <div className="space-y-2">
            {incoming.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-(--color-text-primary) truncate">
                    {p.partner?.displayName ?? p.partner?.handle ?? '—'}
                  </p>
                  <p className="text-[11px] text-(--color-text-tertiary)">@{p.partner?.handle}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => respond(p.id, 'accept')}
                    className="flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                  >
                    <Check className="w-3 h-3" /> Kabul
                  </button>
                  <button
                    onClick={() => respond(p.id, 'reject')}
                    className="flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors"
                  >
                    <X className="w-3 h-3" /> Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gönderilen teklifler */}
      {outgoing.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest mb-2">Gönderilen Teklifler</p>
          <div className="space-y-2">
            {outgoing.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-background-secondary) px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-(--color-text-primary) truncate">
                    {p.partner?.displayName ?? p.partner?.handle ?? '—'}
                  </p>
                  <p className="text-[11px] text-(--color-text-tertiary)">@{p.partner?.handle} · Yanıt bekleniyor</p>
                </div>
                <button
                  onClick={() => dissolve(p.id)}
                  className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
                  title="Teklifi geri çek"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && incoming.length === 0 && outgoing.length === 0 && !proposing && (
        <div className="py-10 text-center rounded-2xl border border-dashed border-(--color-border)">
          <Handshake className="w-8 h-8 text-(--color-text-tertiary) mx-auto mb-2" />
          <p className="text-sm text-(--color-text-tertiary)">Henüz ittifak yok</p>
        </div>
      )}

      {proposing ? (
        <div className="rounded-xl border border-(--color-border) p-4 space-y-3">
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest">İttifak Teklifi</p>
          <input
            type="text"
            value={targetHandle}
            onChange={(e) => setTargetHandle(e.target.value)}
            placeholder="Topluluk handle'ı (örn. fotografcilar)"
            className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
          />
          <div className="flex gap-2">
            <button
              onClick={propose}
              disabled={saving || !targetHandle.trim()}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Handshake className="w-3.5 h-3.5" />}
              Gönder
            </button>
            <button
              onClick={() => setProposing(false)}
              className="text-sm px-4 py-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setProposing(true)}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-full border border-dashed border-(--color-border) text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:border-(--color-border-strong) transition-colors w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          İttifak Teklifi Gönder
        </button>
      )}
    </div>
  )
}

// ── Votes ─────────────────────────────────────────────────────────────────────

function VotesSettings({ community }: { community: Community }) {
  const [votes, setVotes] = useState<import('@/lib/api').ConfederationVote[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', options: ['', ''], targetHandles: '', closesInHours: 48,
  })

  useEffect(() => {
    api.communities.votes(community.handle)
      .then(setVotes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [community.handle])

  function setOption(i: number, value: string) {
    setForm((f) => { const opts = [...f.options]; opts[i] = value; return { ...f, options: opts } })
  }

  function addOption() {
    if (form.options.length >= 6) return
    setForm((f) => ({ ...f, options: [...f.options, ''] }))
  }

  function removeOption(i: number) {
    if (form.options.length <= 2) return
    setForm((f) => { const opts = f.options.filter((_, idx) => idx !== i); return { ...f, options: opts } })
  }

  async function createVote() {
    const targets = form.targetHandles.split(',').map((h) => h.trim()).filter(Boolean)
    const options = form.options.map((o) => o.trim()).filter(Boolean)
    if (!form.title.trim() || options.length < 2 || targets.length === 0) return
    setSaving(true)
    try {
      await api.communities.createVote(community.handle, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        options,
        targetHandles: targets,
        closesInHours: form.closesInHours,
      })
      const updated = await api.communities.votes(community.handle)
      setVotes(updated)
      setForm({ title: '', description: '', options: ['', ''], targetHandles: '', closesInHours: 48 })
      setCreating(false)
      toast.success('Oylama başlatıldı.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı.')
    } finally { setSaving(false) }
  }

  async function deleteVote(voteId: string) {
    try {
      await api.communities.deleteVote(community.handle, voteId)
      setVotes((prev) => prev.filter((v) => v.id !== voteId))
      toast.success('Oylama silindi.')
    } catch { toast.error('Silinemedi.') }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" /></div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--color-text-secondary) leading-relaxed">
        Müttefik topluluklarla ortak kararlar almak için oylama başlat. Her topluluğun üyeleri kendi sayfalarında oy kullanır.
      </p>

      {votes.length > 0 && (
        <div className="space-y-2">
          {votes.map((v) => (
            <div key={v.id} className="flex items-start gap-3 rounded-xl border border-(--color-border) px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cn('text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full', v.closed ? 'bg-(--color-background-secondary) text-(--color-text-tertiary)' : 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400')}>
                    {v.closed ? 'Kapandı' : 'Aktif'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-(--color-text-primary) truncate">{v.title}</p>
                <p className="text-[11px] text-(--color-text-tertiary)">{v.totalVotes} oy · {v.options.length} seçenek</p>
              </div>
              {v.isInitiator && (
                <button
                  onClick={() => deleteVote(v.id)}
                  className="p-1.5 rounded-lg text-(--color-text-tertiary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {votes.length === 0 && !creating && (
        <div className="py-10 text-center rounded-2xl border border-dashed border-(--color-border)">
          <span className="text-3xl">🗳️</span>
          <p className="text-sm text-(--color-text-tertiary) mt-2">Henüz oylama yok</p>
        </div>
      )}

      {creating ? (
        <div className="rounded-xl border border-(--color-border) p-4 space-y-3">
          <p className="text-xs font-semibold text-(--color-text-tertiary) uppercase tracking-widest">Yeni Oylama</p>
          <input
            type="text" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Oylama başlığı"
            className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Açıklama (isteğe bağlı)"
            rows={2}
            className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral) resize-none"
          />
          <div className="space-y-2">
            <p className="text-xs text-(--color-text-tertiary)">Seçenekler</p>
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text" value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Seçenek ${i + 1}`}
                  className="flex-1 text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
                />
                {form.options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="p-2 text-(--color-text-tertiary) hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {form.options.length < 6 && (
              <button onClick={addOption} className="text-xs text-(--color-coral) hover:underline">+ Seçenek ekle</button>
            )}
          </div>
          <input
            type="text" value={form.targetHandles}
            onChange={(e) => setForm((f) => ({ ...f, targetHandles: e.target.value }))}
            placeholder="Hedef topluluklar (virgülle ayır, örn: fotografcilar, yolcular)"
            className="w-full text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-(--color-text-secondary)">Süre (saat):</label>
            <input
              type="number" min={1} max={168} value={form.closesInHours}
              onChange={(e) => setForm((f) => ({ ...f, closesInHours: Number(e.target.value) }))}
              className="w-20 text-sm bg-(--color-background-secondary) border border-(--color-border) rounded-xl px-3 py-2 text-(--color-text-primary) focus:outline-none focus:ring-2 focus:ring-(--color-coral)"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createVote}
              disabled={saving || !form.title.trim() || form.options.filter(Boolean).length < 2 || !form.targetHandles.trim()}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-(--color-coral) text-white font-semibold hover:bg-(--color-coral-hover) disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Başlat
            </button>
            <button onClick={() => setCreating(false)} className="text-sm px-4 py-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-background-secondary) transition-colors">
              İptal
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-full border border-dashed border-(--color-border) text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:border-(--color-border-strong) transition-colors w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Oylama Başlat
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SettingsTab = 'general' | 'templates' | 'wiki' | 'flairs' | 'badges' | 'partnerships' | 'votes' | 'modlog'

export default function CommunitySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [community, setCommunity] = useState<Community | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<SettingsTab>('general')

  useEffect(() => {
    api.communities.get(slug)
      .then((c) => {
        if (c.viewer_status !== 'owner' && c.viewer_status !== 'mod') {
          router.replace(`/c/${slug}`)
          return
        }
        setCommunity(c)
      })
      .catch(() => router.replace('/communities'))
      .finally(() => setLoading(false))
  }, [slug, router])

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-20 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-(--color-text-tertiary)" />
      </div>
    )
  }
  if (!community) return null

  const gradient = communityGradient(community.color_index)

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-(--color-background)/90 backdrop-blur-sm border-b border-(--color-border-secondary)">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-full hover:bg-(--color-background-secondary) transition-colors text-(--color-text-tertiary)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar className="w-7 h-7 rounded-xl flex-shrink-0">
              {community.avatar_url && <AvatarFallback style={{ background: gradient }} />}
              <AvatarFallback className="rounded-xl text-[10px] font-bold text-white" style={{ background: gradient }}>
                {community.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold text-sm text-(--color-text-primary) truncate leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {community.name}
              </p>
              <p className="text-[11px] text-(--color-text-tertiary) leading-tight">Ayarlar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-(--color-border-secondary)">
        <div className="flex overflow-x-auto scrollbar-none">
          {([
            { key: 'general' as SettingsTab, label: 'Genel', icon: <Settings className="w-3.5 h-3.5" /> },
            { key: 'templates' as SettingsTab, label: 'Şablonlar', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
            { key: 'wiki' as SettingsTab, label: 'Wiki', icon: <BookOpen className="w-3.5 h-3.5" /> },
            { key: 'flairs' as SettingsTab, label: 'Flair', icon: <Tag className="w-3.5 h-3.5" /> },
            { key: 'badges' as SettingsTab, label: 'Rozetler', icon: <Award className="w-3.5 h-3.5" /> },
            { key: 'partnerships' as SettingsTab, label: 'İttifak', icon: <Handshake className="w-3.5 h-3.5" /> },
            { key: 'votes' as SettingsTab, label: 'Oylamalar', icon: <Vote className="w-3.5 h-3.5" /> },
            { key: 'modlog' as SettingsTab, label: 'Modlog', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                tab === key
                  ? 'border-(--color-coral) text-(--color-coral)'
                  : 'border-transparent text-(--color-text-tertiary) hover:text-(--color-text-primary)',
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === 'general' && (
          <GeneralSettings community={community} onSave={setCommunity} />
        )}
        {tab === 'templates' && (
          <TemplatesSettings community={community} onSave={setCommunity} />
        )}
        {tab === 'wiki' && (
          <WikiSettings community={community} />
        )}
        {tab === 'flairs' && (
          <FlairsSettings community={community} />
        )}
        {tab === 'badges' && (
          <BadgesSettings community={community} />
        )}
        {tab === 'partnerships' && (
          <PartnershipsSettings community={community} />
        )}
        {tab === 'votes' && (
          <VotesSettings community={community} />
        )}
        {tab === 'modlog' && (
          <ModlogSettings community={community} />
        )}
      </div>
    </div>
  )
}
