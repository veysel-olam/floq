# Federasyon (ActivityPub) — Kalan İşler

> Çekirdek federasyon **uçtan uca çalışıyor** (takip, gönderi teslimi, DM, topluluk, boost, render).
> Bu dosya geri kalan **uzun kuyruğu** takip eder: az kullanılan aktiviteler, moderasyon
> federasyonu, ölçek/dayanıklılık ve test kapsamı. Öncelik sırası tartışılarak belirlenir.

Son güncelleme: 2026-05-31

---

## ✅ Tamamlandı (bağlam için)

WebFinger · Actor (public) · NodeInfo · Outbox · HTTP imzaları (sign+verify) ·
content-type (`activity+json`) · Inbox: Follow/Accept/Reject/Undo/Create/Delete/Like/Announce/Update/Move ·
çift yönlü takip (kullanıcı+kilitli+grup) · giden teslimat · uzak içerik render (HTML→metin, medya, link önizleme) ·
uzak actor sayıları + refresh TTL · thread/yanıt çözümleme · boost timeline · backfill (outbox) ·
**DM federasyonu** · **topluluklar (FEP-1b12)** · relay · arama-çözümleme · FEP-8b32 (ed25519) · FEP-c7d3 (doğrulanmış linkler)

---

## 🔶 Eksik / Zayıf — Özellik tarafı

### Yüksek değer
- [x] **Uzak Like kayıtları** — Gelen `Like` artık `likes` tablosuna kayıt ekliyor (idempotent) → uzak beğeniler "kim beğendi" listesinde görünüyor; `Undo→Like` kaydı silip sayacı düşürüyor. (2026-05-31)
- [x] **Reaksiyon (emoji) federasyonu** — `buildEmojiReact` + giden EmojiReact/Undo (uzak gönderiye reaksiyon) + gelen `EmojiReact`/`Undo→EmojiReact` (reactions tablosuna). Misskey/Pleroma ile interop. (2026-05-31)
- [ ] **Quote/alıntı federasyonu** — Quote post FEP'i (`quoteUrl` / FEP-e232) tam değil; uzak alıntılar düzgün bağlanmıyor olabilir.
- [ ] **Uzak medya proxy/cache** — Uzak görseller origin sunucudan yükleniyor (gizlilik/kırık-link riski). `proxyMediaUrl` benzeri bir önbellek + R2/MinIO'ya kopyalama.

### Orta
- [ ] **Moderasyon federasyonu** — `Flag` (rapor) giden/gelen, `Block` federasyonu doğrulanmadı; domain suspend var ama uçtan uca test edilmedi.
- [ ] **Account Move (hesap taşıma)** — Handler mevcut (`case 'Move'`) ama gerçek bir göçle test edilmedi (`alsoKnownAs` + takipçi taşıma).
- [ ] **Koleksiyon sayfalama** — Uzak `followers`/`following` listeleri çekilmiyor (sadece `totalItems` sayısı). Modal "liste origin'de" diyor — istenirse ilk sayfa çekilebilir (çoğu sunucu kapatır).
- [ ] **Anket (Question) oyları** — Gelen oylar kısmen işleniyor; giden anket güncellemeleri + kapanış tam doğrulanmadı.

### Düşük / opsiyonel
- [ ] **oEmbed dış gönderiler** (ertelendi)
- [ ] **`Update` (profil/gönderi düzenleme)** uzak senkronu — handler var, edge-case'ler test edilmedi.
- [ ] **Hashtag takip federasyonu** — yerel var; federe tag akışı netleştirilmeli.

---

## 🔴 Üretim Olgunluğu — Sağlamlık & Ölçek

- [ ] **Ölçekte teslimat** — Binlerce takipçiye fan-out; sharedInbox dedup var ama batch/rate-limit dayanıklılığı sınırlı.
- [ ] **Retry / idempotency** — BullMQ retry var; ölü-mektup, exponential backoff ince ayarı, tekrarlı teslim koruması gözden geçirilmeli.
- [ ] **İmza edge-case'leri** — RFC 9421 (yeni HTTP Message Signatures) ve `(created)`/`(expires)` desteklenmiyor; yalnızca draft-cavage. Bazı yeni sunucularla sorun olabilir.
- [ ] **Authorized-fetch / secure mode** — Bilinçli kapalı (interop için). İstenirse opsiyonel açılabilir.
- [ ] **Tombstone** — Silinen gönderi fetch'inde `Tombstone` dönüyor; gelen tarafta tam işlenmesi doğrulanmalı.
- [ ] **Instance-level rate limiting / abuse** — Gelen inbox spam'ine karşı koruma.

---

## 🌉 Köprüler (Bluesky / Nostr / AT Protocol)

- [x] **Bluesky cross-post** — `crosspostToBluesky` ana web post akışına bağlandı (önceden yalnızca Mastodon-API yolundaydı). Bağlı + `crosspostEnabled` ise orijinal public/unlisted gönderiler Bluesky'ye gidiyor. (2026-05-31)
- [x] **Nostr cross-post** — `crosspostToNostr` (kind:1 event imzala + relay publish) eklendi; `actors.nostr_crosspost_enabled` toggle'ı + ayarlarda UI (kimlik oluştur, npub/NIP-05, crosspost toggle, rehber). Nostr artık Bluesky paritesinde. (2026-05-31)
- [x] **Bluesky cross-post medya** — `uploadImageToBluesky` (sharp ile ~1MB blob limitine küçültme) + `app.bsky.embed.images` (max 4). Görseller artık Bluesky'ye gidiyor. (2026-06)
- [x] **Köprü cross-post job'a alındı** — `crosspostQueue` (BullMQ, 3 deneme + exponential backoff). Hem web hem Mastodon-API yolu `enqueueBlueskyCrosspost`/`enqueueNostrCrosspost` kullanıyor; fire-and-forget kaldırıldı. (2026-06)
- [x] **Bluesky inbound** — `importBlueskyPosts`: `import_enabled` olan kullanıcıların kendi Bluesky gönderileri 10 dakikalık `sweepBlueskyImports` job'ı ile floq'a aynalanıyor (yerel post olarak doğrudan insert → crosspost tetiklenmez). Ayarlar → Köprüler'de toggle; açınca anlık ilk import. (2026-06)
- [x] **Cross-post geri-besleme döngüsü koruması** — `posts.bsky_uri`: crosspost'ta dönen at:// uri yazılır, import'ta dedupe için okunur; kendi çıktımızı asla geri aynalamayız. (2026-06)
- [ ] **Bluesky inbound — kapsam genişletme** — Şu an yalnızca kullanıcının kendi üst-düzey gönderileri (yanıt/repost/medya hariç). İçe aktarılan gönderiler ActivityPub ile dışarı federe **edilmiyor** (yalnızca floq içinde görünür). Medya + yanıt + AP fan-out sonraki adım.
- [ ] **Bluesky inbound — etkileşim geri akışı** — Bluesky'deki beğeni/yanıt sayaçlarının floq'a yansıtılması doğrulanmadı.

## 🧪 Test & Gözlemlenebilirlik

- [x] **Federasyon builder conformance + CI test job** — `federation-builders.test.ts` (16 saf unit test: Note/Quote/DM/Create/Follow/Accept/Undo/Like/Announce/EmojiReact/Block/Delete AP şekilleri) + CI'da `Unit Tests` job. Canlı HTTP conformance suite `AP_CONFORMANCE=1` ile çalışır (server'sız `pnpm test` yeşil). (2026-05-31)
- [ ] **Canlı conformance CI'da** — HTTP suite hâlâ canlı instance gerektiriyor; gerçek Mastodon/Lemmy'ye karşı otomatik e2e yok (e2e job advisory).
- [ ] **Federasyon teşhis paneli** — Admin'de teslimat sağlığı (`instances.lastDeliverySuccess`) var; daha görünür bir "federasyon durumu" ekranı.
- [ ] **Yapısal loglama** — Inbox/outbox aktivite akışını izlemek için (bu oturumda manuel SQL ile debug ettik).

---

## 🧹 Bakım / Hijyen

- [ ] **Yörüngede kalan uzak içerik temizliği** — Takip bırakılan/silinen uzak actor + gönderileri biriken çöp. Periyodik otomatik temizlik (yerel ilişkisi kalmamış uzak içeriği N gün sonra sil). (2026-05-31'de elle bir kez temizlendi: 119→1 actor.)
- [ ] **`instance.actor` takip anomalisi** — Yeni hesapta beliren `instance.actor` follow'unun kaynağı bulunamadı; tekrar ederse köken araştırılmalı.
- [ ] **Outbox-diff senkronu** — Kaçırılan `Delete`'ler için (takip pending'ken silinen gönderiler) periyodik outbox karşılaştırması. (veatrul için elle yapıldı.)

---

### Notlar
- Öncelik önerisi: **Uzak Like kayıtları** → **Reaksiyon federasyonu** → **Moderasyon (Flag/Block)** → **ölçek/retry** → **conformance testleri**.
- Yeni fikirler buraya değil [IDEAS.md](IDEAS.md)'ye; bu dosya yalnızca **federasyon** kuyruğu.
