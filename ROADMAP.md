# floq — Roadmap

> "Flow together, own your data."
> Merkeziyetsiz, federe, kullanıcı özgürlüğü odaklı sosyal ağ.

---

## Vizyon

floq, kullanıcıların verilerini gerçekten kendilerinin olan bir sosyal ağdır.
Algoritma manipülasyonu yok, platform bağımlılığı yok — sadece akış.

**Temel ilkeler:**
- Veriler kullanıcıya aittir (taşıma, silme, dışa aktarma tam destek)
- Federasyon birinci sınıf vatandaştır (Mastodon, Bluesky köprüsü)
- Algoritma şeffaftır ve kullanıcı tarafından kontrol edilir
- Minimalist UX — karmaşıklık arkada kalır, arayüz temiz kalır

---

## Tech Stack

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| Monorepo | Turborepo + pnpm workspaces | Paylaşımlı types, hızlı build |
| Frontend | Next.js 15 (App Router) + TypeScript | SSR/SSG, iyi SEO, AP endpoint'leri |
| UI | shadcn/ui + Tailwind CSS v4 | Floq brand renkleri, erişilebilir |
| Fonts | Outfit (display) + DM Sans (body) | Brand kimliği |
| Backend | Fastify + TypeScript | Yüksek performans, federation için uygun |
| ORM | Drizzle ORM | TypeScript-first, migrate kolay |
| Veritabanı | PostgreSQL 17 | Karmaşık sorgular, full-text search |
| Cache/Queue | Redis 7 + BullMQ | Real-time, federation delivery queue |
| Auth | Better Auth | Lucia deprecated, daha aktif topluluk |
| Dosya | MinIO (local) / Cloudflare R2 (prod) | S3-compatible, maliyet etkin |
| Real-time | Server-Sent Events | Feed güncellemeleri, bildirimler |
| Federation | ActivityPub (ActivityStreams 2.0) | Mastodon uyumluluğu |
| AT Protocol | DID:web + XRPC + Feed Generator | Bluesky uyumluluğu |

---

## Monorepo Yapısı

```
floq.com/
├── apps/
│   ├── web/          # Next.js frontend (port 3000)
│   └── api/          # Fastify backend (port 3001)
├── packages/
│   ├── types/        # Paylaşımlı TypeScript tipleri
│   ├── activitypub/  # AP protocol builder/parser
│   ├── ui/           # shadcn/ui bileşen kütüphanesi
│   └── config/       # ESLint, TypeScript, Tailwind config
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## Faz Planı

### Phase 0 — Altyapı & Temel Kurulum ✅
*Tamamlandı*

- [x] Turborepo + pnpm monorepo init
- [x] apps/web — Next.js 15, TypeScript, Tailwind v4, shadcn/ui kurulumu
- [x] apps/api — Fastify, TypeScript, Drizzle ORM kurulumu
- [x] packages/types — temel tip tanımları
- [x] packages/ui — Floq brand token'ları (renkler, fontlar, logo)
- [x] docker-compose.yml — PostgreSQL 17 + Redis 7
- [x] Drizzle schema — temel tablolar (users, posts, follows, sessions)
- [x] DB migration sistemi
- [x] Environment variable yönetimi (Zod validation)
- [x] ESLint + Prettier + Husky (pre-commit hooks)
- [x] README.md + geliştirme rehberi

---

### Phase 1 — Çekirdek Sosyal Ağ ✅
*Tamamlandı*

#### 1a — Kimlik Doğrulama
- [x] Kayıt ol (email + şifre, handle seçimi)
- [x] Giriş yap / çıkış yap
- [x] Oturum yönetimi (Better Auth + Redis)
- [x] Handle validasyonu (@ prefix, benzersiz, AP uyumlu format)
- [x] Email doğrulama

#### 1b — Kullanıcı Profilleri
- [x] Profil sayfası (@handle)
- [x] Biyografi, görsel URL, başlık
- [x] Avatar yükleme (MinIO/R2)
- [x] Header/banner görsel
- [x] Takipçi / takip edilen sayacı

#### 1c — Gönderiler
- [x] Yazı oluşturma (max 500 karakter)
- [x] Görsel ekleme (max 4 görsel)
- [x] Görünürlük: public / unlisted / followers-only / direct
- [x] İçerik uyarısı (CW) — hassas içerik
- [x] Gönderi silme

#### 1d — Etkileşimler
- [x] Beğeni (like)
- [x] Paylaş / Boost (repost)
- [x] Yanıt (reply, thread yapısı)
- [x] Yer imi (bookmark)
- [x] Takip et / takibi bırak

#### 1e — Zaman Tüneli
- [x] Home feed (takip edilenler)
- [x] Explore / keşfet (public gönderiler)
- [x] Profil feed'i (gönderiler + boost'lar)
- [x] Sayfalama (cursor-based pagination)

#### 1f — Bildirimler
- [x] Beğeni, boost, yanıt, takip bildirimleri
- [x] Bildirim sayfası (silme desteğiyle)
- [x] Okunmamış sayacı
- [x] Tekrar bildirim koruması (deduplication)

#### 1g — Temel UI
- [x] Floq brand tasarım sistemi (shadcn/ui üzerine)
- [x] Ana layout (sidebar, feed, rightpanel)
- [x] Responsive tasarım (mobile-first)
- [x] Dark/light mod
- [x] Onboarding akışı (ilk giriş ekranı)

---

### Phase 2 — Kullanıcı Özgürlüğü & Güvenlik ✅
*Tamamlandı*

- [x] **Veri dışa aktarma** — JSON arşiv (ActivityPub formatı)
- [x] **Hesap taşıma** — ActivityPub `Move` activity, yeni sunucuya göç
- [x] **Hesap silme** — cascade, tüm veriler
- [x] **Blok & mute** — kullanıcı bazlı
- [x] **Filtreler** — anahtar kelime filtreleri
- [x] **İki faktörlü doğrulama** (TOTP)
- [x] **Oturum yönetimi** — aktif oturumları gör, sonlandır
- [x] **Gizlilik ayarları** — profil görünürlüğü (isLocked)

---

### Phase 3 — Özgür Algoritma (Free Algorithm) ✅
*Tamamlandı*

- [x] **Feed kuralları motoru** — kaynak, sıralama, filtre
- [x] **Feed presetleri** — Saf Kronolojik, Sadece Orijinaller, Trending, Dengeli
- [x] **Listeler** — özel takip listeleri, feed kaynağı olarak
- [x] **Feed builder UI** — preset seçici + özelleştirme

---

### Phase 4 — ActivityPub Federasyonu ✅
*Tamamlandı*

#### 4a — Core ActivityPub
- [x] **WebFinger** endpoint (`/.well-known/webfinger`)
- [x] **Actor** profil endpoint (`/users/:handle`)
- [x] **Inbox / Outbox** endpoint'leri
- [x] **HTTP Signatures** (istek imzalama/doğrulama)
- [x] **NodeInfo** endpoint (`/.well-known/nodeinfo`)

#### 4b — Aktivite Tipleri
- [x] `Create/Note` — gönderi yayınlama
- [x] `Follow / Accept / Reject` — takip
- [x] `Like / Undo Like` — beğeni
- [x] `Announce / Undo Announce` — boost
- [x] `Delete` — gönderi silme
- [x] `Update/Actor` — profil güncelleme
- [x] `Move` — hesap taşıma

#### 4c — Federation Altyapısı
- [x] **BullMQ kuyruğu** — outbox aktivite teslimi
- [x] **Inbox işlemcisi** — gelen aktiviteleri handle etme
- [x] **Remote actor cache** — uzak profilleri önbelleğe alma
- [x] **Instance engelleme** — defederate
- [x] **Media proxy** — uzak görselleri güvenli proxyleme

---

### Phase 5 — AT Protocol / Bluesky Köprüsü 🔄
*Kısmen tamamlandı — temel uyumluluk aktif*

- [x] **DID:web** — her kullanıcı için `did:web:domain:users:handle` belgesi
- [x] **XRPC altyapısı** — `com.atproto.server.describeServer`, `com.atproto.identity.resolveHandle`
- [x] **Feed Generator** — `app.bsky.feed.describeFeedGenerator`, `app.bsky.feed.getFeedSkeleton`
  - Public feed (kronolojik)
  - Trending feed (etkileşim bazlı)
- [x] **AT Record endpoint'leri** — gönderi ve profil AT formatında
- [x] **Bluesky hesap bağlama** — profilde Bluesky handle gösterimi
- [x] **Bridgy Fed köprüsü** — AP aracılığıyla Bluesky'dan takip edilebilirlik
- [ ] Bluesky feed generator kayıt (Bluesky AppView onayı gerektirir)
- [ ] Çift yönlü cross-posting (Bluesky OAuth — gelecek iterasyon)

---

### Phase 6 — floq-Özgün Özellikler ✅
*Tamamlandı*

- [x] **Flows** — konu bazlı kanallar
- [x] **Bağlantı Haritası** — görsel ağ haritası (D3 force graph)
- [x] **Anlar (Moments)** — geçici 24 saatlik paylaşımlar
- [x] **Röportaj modu** — herkese açık S&A oturumu
- [x] **Floq Spaces** — sesli/yazılı toplantı odaları
- [x] **Federation Pulse** — instance bağlantı istatistikleri

---

### Phase 7 — Canlıya Çıkış Hazırlığı ✅
*Tamamlandı*

- [x] Performans optimizasyonu (Core Web Vitals)
- [x] Güvenlik hardening (rate limiting, CSRF, CSP headers)
- [x] PWA (manifest, service worker)
- [x] E2E testler (Playwright)
- [x] CI/CD pipeline (GitHub Actions)
- [x] Monitoring (Sentry + Prometheus)
- [x] Landing page (floq.com ana sayfa)
- [x] Beta invite sistemi

---

---

## v1.1 — Spec Eksiksizliği & Temel UX
*Planlı — hızlı iterasyon*

> Mevcut AP implementasyonundaki boşlukları kapat, temel keşif ve içerik özelliklerini tamamla.

#### Federasyon Spec Tamamlama
- [x] **`Update/Note` aktivitesi** — gönderi düzenleme federasyonu (outbound + inbound inbox handler)
- [x] **Düzenleme geçmişi** — edit history snapshot'ı, federe Update/Note'ta da kaydediliyor
- [x] **`Question` type (Anket)** — Create/Question outbound, inbound vote (Create/Note with name), Update/Question broadcast
- [x] **`Tombstone` yönetimi** — 410 Gone + Tombstone + `formerType` + `deletedAt` timestamp
- [x] **Custom emoji federasyonu** — outbound tag array, inbound upsert
- [x] **Followers-only içerik güvencesi** — `perActorInbox` ile her takipçinin kişisel inbox'ına gönderim
- [x] **Sensitive content etiketleri** — `sensitive` + `summary` (CW) outbound/inbound

#### Arama & Keşif
- [x] **Full-text arama** — `websearch_to_tsquery('turkish')` + GIN index, ILIKE fallback
- [x] **Hashtag AP federasyonu** — federe gelen gönderiler tag array'e yazılıyor, hashtag feed'i local+remote gösteriyor
- [x] **`noindex` isteği (FEP-5feb)** — `indexable` field AP actor'da, inbound `noIndex` kaydediliyor
- [x] **Yerel / federe keşfet ayrımı** — `scope=local|federated|all` API param, explore filtre panelinde Tümü/Yerel/Federe toggle

#### İçerik & Etkileşim
- [x] **RSS/Atom çıktısı** — `/users/:handle/rss`, `/tags/:tag/rss`
- [x] **oEmbed** — `/oembed?url=` endpoint
- [x] **OpenGraph önizlemeleri** — link paylaşımında kart önizleme (linkPreview API)

---

## v1.2 — Güven & Güvenlik Katmanı
*Planlı — orta kapsam*

> İçeriğin kriptografik olarak doğrulanabilmesi ve kullanıcı mahremiyetinin sunucu bağımsız güvence altına alınması.

#### Kriptografik Güven
- [x] **Object Integrity Proofs (FEP-8b32)** — AP nesnelerini HTTP isteğinden bağımsız imzala; relay'ler içeriği değiştiremez
- [x] **Authorized Fetch** — imzasız AP GET isteklerini reddet; yetkisiz scraping önlenir
- [x] **Content addressing** — gönderi hash'iyle bütünlük kontrolü; değiştirilmiş içerik tespit edilebilir
- [x] **W3C ActivityPub conformance test suite** — resmi test takımından geçmek

#### Kimlik Katmanı
- [x] **DID:key desteği** — sunucusuz, tamamen öz-egemen kimlik (DID:web'in ötesi)
- [x] **Anahtar rotasyonu** — imzalama anahtarı sızdığında hesap kurtarma akışı
- [x] **Verifiable Credentials (W3C VC)** — DID'e bağlı, doğrulanabilir gerçek dünya kimliği
- [x] **WebAuthn / Passkey** — şifresiz giriş; FIDO2 standardı

#### Mahremiyet & E2E Şifreleme
- [x] **E2E şifreli DM** — X25519 ECDH sealed box; sunucu mesajları okuyamasın
- [x] **Forward secrecy** — mesaj başına efemeral anahtar; eski mesajlar ele geçirilemesin
- [x] **IP koruması** — federation isteklerinde kullanıcı IP'si açığa çıkmasın
- [x] **GDPR veri raporu** — "verilerim nerede, kimle paylaşıldı" şeffaf raporu
- [x] **Tor / .onion adres desteği** — sansür direnci

#### FEP Uyumu
- [x] **FEP-8b32** Object Integrity Proofs
- [x] **FEP-c7d3** Ownership
- [x] **FEP-d36d** Sensitive content standardizasyonu
- [x] **FEP-5feb** Search indexing consent

---

## v2.0 — Ekosistem & Merkeziyetsiz Yönetim
*Uzun vadeli*

> Floq'u yalnızca bir uygulama değil, fediverse'ün tam bir parçası hâline getir.

#### Ağ Genişliği (Interoperability)
- [x] **Mastodon API uyumluluğu** — Ivory, Tusky, Mona, Elk gibi istemciler doğrudan bağlansın
- [x] **Mastodon streaming API (WebSocket)** — üçüncü parti istemciler gerçek zamanlı çalışsın
- [x] **ActivityPub Relay desteği** — küçük instance'ların birbirini keşfetmesi için relay ağına katılım
- [x] **WebSub / PubSubHubbub** — federation'da polling yerine push; gerçek zamanlı ve ölçeklenebilir
- [x] **Nostr köprüsü (NIP-05)** — kimlik doğrulama katmanında birleşim
- [x] **ActivityPub Groups (FEP-1b12)** — standart tabanlı topluluk grupları
- [x] **Bluesky çift yönlü cross-posting** — Bluesky OAuth ile tam entegrasyon

#### Moderasyon (Merkeziyetsiz)
- [x] **Paylaşılan engel listeleri** — Oliphant/FediBlock standartlarına uyum; güvenilir liste aboneliği
- [x] **Rapor iletimi** — uzak instance moderatörüne ulaşan cross-instance rapor sistemi
- [x] **İçerik etiketleri (labeler)** — AT Protocol tarzı merkeziyetsiz içerik sınıflandırması
- [x] **Şeffaf moderasyon logu** — alınan kararlar toplulukça görülebilsin
- [x] **İtiraz sistemi** — silinen/askıya alınan içerik için kullanıcı itirazı akışı

#### Instance Yönetimi
- [x] **Admin paneli** — kullanıcı yönetimi, federation kuyruğu izleme, depolama kotası
- [x] **Kayıt modları** — açık / onay bekleyen / davet zorunlu
- [x] **Instance kuralları & hakkında sayfası** — insan-okunabilir, NodeInfo'nun ötesi
- [x] **Federation sağlığı monitörü** — hangi instance yanıt vermiyor, teslimat gecikmeleri
- [x] **Dead letter queue dashboard** — başarısız federation teslimatlarını izle ve yeniden dene

#### Mobil & Platform
- [x] **React Native uygulama** — iOS + Android, Mastodon API üzerine inşa
- [x] **Web Share Target API** — diğer uygulamalardan "Floq'a paylaş"
- [x] **Web Push bildirimleri** — PWA üzerinde native benzeri push

---

## Veri Modeli (Özet)

```
users          — hesap bilgileri, AP actor verisi
posts          — gönderiler, görünürlük, AP object ID
follows        — takip ilişkileri (local + federated)
likes          — beğeniler
boosts         — yeniden paylaşımlar
replies        — yanıt ağacı (parent_id)
notifications  — bildirim kuyruğu
media          — yüklenen dosyalar
instances      — bilinen federe sunucular
remote_actors  — cache edilmiş uzak profiller
feed_rules     — kullanıcı feed konfigürasyonları
lists          — özel takip listeleri
sessions       — aktif oturumlar
```

---

## Öncelik Sırası

```
Phase 0–7 (tamamlandı)
    ↓
v1.1 — Spec eksiksizliği & keşif (hashtag, full-text search, edit history, poll)
    ↓
v1.2 — Güven & güvenlik (OIP, authorized fetch, E2E DM, passkey)
    ↓
v2.0 — Ekosistem (Mastodon API compat, admin panel, relay, mobil)
```

---

## Kapsam Dışı (Şimdilik)

- Ücretli özellikler / abonelik sistemi
- Reklam altyapısı
- Video stream / canlı yayın
- Bluesky cross-posting → v2.0'a taşındı

---

## Sonraki Adım: İki Faz

### Faz A — Gemi Önce
*Şu anki odak*

> Bir proje ancak içinde insan sesi olduğunda eser haline gelir.

Kod hazır. Asıl iş altyapı:

- [ ] Production sunucu (Hetzner / DigitalOcean, ~€5-10/ay)
- [ ] Domain + SSL (Let's Encrypt)
- [ ] PostgreSQL + Redis production ortamı
- [ ] Cloudflare R2 (dosya depolama)
- [ ] CI/CD aktif et (GitHub Actions zaten yazılı)
- [ ] Email (Resend ücretsiz tier — kayıt doğrulaması için)
- [ ] Environment variables production'a taşı
- [ ] Topluluk kuralları + gizlilik politikası sayfası
- [ ] Beta davet sistemi aç, ilk 50-100 kişiyi elle davet et

**Bu fazda sıfır yeni özellik. Olanı çalıştır, kırılanı düzelt, insanları dinle.**

---

### Faz B — Derinleş
*Gerçek kullanıcı geri bildirimi geldikten sonra*

Gerçek kullanıcılar varken teknik kararlar çok daha sağlıklı alınır.
v2.0 özelliklerinden hangisi isteniyor, did:web köprüsüne gerek var mı,
hangi niş büyüyor — bunları kullanıcılar söyler, biz tahmin etmeyiz.

Bu faz için liste yok. Faz A'dan öğrenilecekler listeyi yazar.

---

*Son güncelleme: Mayıs 2026*
