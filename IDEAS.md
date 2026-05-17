# floq — Fikir Havuzu

Burası "şimdi yapma ama unutma" listesi. Öncelik sırası yok, tartışılarak belirlenir.

---

## Eksik Özellikler (audit sonucu)

### Kesinlikle yok
_(Temizlendi — tüm maddeler tamamlandı)_

### Kısmen var, tamamlanmamış
_(Temizlendi — tüm maddeler tamamlandı)_

### Tamamlandı ✅
| Özellik | Durum |
|---|---|
| ~~**2FA (TOTP)**~~ | Better Auth `twoFactor()` plugin, settings'te QR+backup codes UI, login akışı |
| ~~**Post düzenleme geçmişi UI**~~ | post-card'da uzun basınca ⋯ menüsünden açılıyor, modal tam çalışıyor |
| ~~**Reaction çeşitleri UI**~~ | Emoji picker (uzun bas), like ile mutual exclusion, 10 emoji destekleniyor |
| ~~**Arama sayfası**~~ | `/explore` sayfasında tam UI mevcut (query, tabs, gelişmiş filtreler, URL `?q=` desteği) |
| ~~**Trend konular UI**~~ | `/explore` Gündem sekmesinde `trendingTags` gösteriliyor |
| ~~**Klavye kısayolları**~~ | `use-keyboard-shortcuts.ts`, layout'a bağlı, `?` yardım dialogu mevcut |
| ~~**Ortak takipçiler**~~ | Profil sayfasında avatar stack + "X ve Y de takip ediyor" metni, API `/mutual-followers` |
| ~~**Profil link paylaşımı**~~ | ⋯ menüsünde Paylaş + Linki Kopyala (kendi profil + başkası) |
| ~~**Profil website alanı**~~ | DB kolonu, settings'te input, profilde tıklanabilir link |
| ~~**Bildirim tercihleri**~~ | Profil sayfasında Bell butonu, `PATCH /api/actors/:handle/notify` |
| ~~**Mention'dan profil kartı**~~ | `MentionLink` komponenti post-card.tsx'te, 350ms hover delay, tam popup |
| ~~**Gönderi istatistikleri**~~ | Post detayda `viewCount`, analitik sayfasında profil ziyareti + toplam görüntülenme |
| ~~**DM grup sohbet**~~ | `conversations` + `conversationMembers` şema, tam API, `/dm/group/[id]` sayfası |
| ~~**Bookmarks grid view**~~ | Liste/grid toggle, `BookmarkGridCard` komponenti mevcut |

---

## Video Desteği (Roadmap)

**Hedef:** Gönderi composer'dan video upload ve oynatma.

**Gerekli altyapı:**
- Object storage: Cloudflare R2 veya AWS S3 (presigned URL ile doğrudan upload)
- Transcode: **Cloudflare Stream** (önerilen — hazır transcode + CDN) veya FFmpeg BullMQ worker
- CDN: video delivery için zorunlu

**Kod değişiklikleri:**
- DB: `media_attachments` tablosuna `duration` kolonu, `mime_type` alanı genişletme
- API: presigned URL endpoint, transcode job tetikleyici, transcode tamamlandığında post güncelleme
- Web: PostComposer'da video seçim/önizleme UI, PostCard'da `<video>` render branch

**Maliyet tahmini (10k video/ay, ~50GB):**
- Cloudflare Stream: ~$10 + $1/1000 dk → mezuniyet projesi için ideal
- AWS S3 + MediaConvert: ~$16/ay → üretim ölçeğinde daha esnek

---

## Yeni Fikirler

### Öncelikli (küçük iş, yüksek değer)
- ~~**Gönderi istatistikleri**~~ ✅ — gönderi detayında `viewCount`, analitik sayfasında profil ziyareti + toplam görüntülenme kartları
- ~~**Bildirim tercihleri**~~ ✅ — profil sayfasında Bell butonu, `/api/actors/:handle/notify` endpoint
- ~~**Mention'dan profil kartı**~~ ✅ — post-card.tsx `MentionLink` komponenti, 350ms hover delay
- ~~**Klavye kısayolları**~~ ✅

### Orta vadeli
- **Alıntı gönderi sayacı** — kimin alıntıladığını listele (API var, UI yok)
- **Sesli mesaj (DM)** — tarayıcı MediaRecorder API ile ses kaydı
- **Gönderi koleksiyonları** — kendi gönderilerini konuya göre gruplama
- **Fediverse köprüsü** — Bluesky/AT Protocol'den içerik görüntüleme (sadece okuma)

### Uzun vadeli / büyük iş
- **Topluluklar** (`/c/sinema`, `/c/galatasaray` vb.) — Reddit benzeri ama ActivityPub federe; moderasyon, üyelik, özel gönderi tipleri. **Tasarım notu:** altyapıyı baştan "genişletilebilir özel içerik tipi destekler" şeklinde kur — sinefiller için film kartı, spor için skor kartı, gamerlar için oyun kartı topluluk başına aktif/pasif yapılabilsin. Topluluklar olmadan bu niş formatların nereye ait olduğu belirsiz kalır.
- **Doğrulama sistemi** — e-posta domain ile (örn. @şirket.com hesapları)
- **Newsletter modu** — hesap "yayıncı" moduna geçince takipçilere e-posta gönderimi
- **Toplu moderasyon** — admin panelinde çoklu seçip işlem
- **Federe arama** — sadece yerel değil, fediverse geneli arama
- **ActivityPub relay** — büyük relay'lere bağlanarak federe içerik artırımı

### UX / Görsel
- **Gönderi taslak kaydetme** — otomatik; şu an localStore'da draft var ama sadece ana sayfa
- **Okuma modu** — uzun thread'leri odaklanmış, temiz görünümde oku
- **Renk teması oluşturucu** — settings'deki tema seçici yerine tam custom picker

---

## Reddedilen / Sonraya Bırakılan
_(buraya taşı, silme — neden yapılmadığını hatırlamak için)_

| Fikir | Neden bekliyor |
|---|---|
| Reklam sistemi | floq'un temel felsefesiyle çelişiyor |
| Algoritmic feed (opsiyonsuz) | Kronolojik birincil olacak, karma ikincil seçenek |
