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
- [ ] **Reaksiyon (emoji) federasyonu** — Yerel reaksiyonlar var; `EmojiReact` (Misskey/Pleroma) gelen/giden federe edilmiyor.
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
- [ ] **Bluesky inbound** — Bluesky'den floq'a içerik akışı? Şu an AT Protocol köprüsü (`atprotocol.ts`: `did.json` + XRPC) floq içeriğini Bluesky okuyucularına **okutuyor**; Bluesky→floq (yanıt/beğeni geri akışı) doğrulanmadı.
- [ ] **Nostr cross-post YOK** — `nostr.ts` yalnızca NIP-05 kimlik (`/.well-known/nostr.json`). Gönderiyi Nostr relay'lerine yayınlayan `crosspostToNostr` yok → eklenebilir (NIP-01 event imzalama + relay publish).
- [ ] **Bluesky cross-post medya** — Şu an yalnızca metin (300 char) + hashtag facet; görsel/medya Bluesky'ye yüklenmiyor.
- [ ] **Köprü cross-post job'a alınmalı** — Şu an `void crosspostToBluesky(...)` fire-and-forget; başarısızlıkta retry yok. BullMQ job'a taşınmalı (federation gibi).
- [ ] **Cross-post geri-besleme döngüsü koruması** — Bluesky'den okunan içerik tekrar Bluesky'ye yazılmamalı (loop guard).

## 🧪 Test & Gözlemlenebilirlik

- [ ] **AP conformance testleri CI'da** — `apps/e2e` advisory (continue-on-error); gerçek bir test Mastodon/Lemmy'ye karşı otomatik suite yok.
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
