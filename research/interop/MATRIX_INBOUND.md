# Anlamsal Kayıp Matrisi — floq Giriş Köprüleri (Katman 1: Statik, INBOUND)

> Otomatik üretildi (`research/interop/audit-inbound.ts`) · 2026-06-05
> Yön: hedef → floq. Nostr inbound implement edilmedi (`–`).

| Boyut | ActivityPub (Mastodon) | AT Protocol (Bluesky) | Nostr |
|---|---|---|---|
| Kimlik | ✓ 1.0 | ✓ 1.0 | – |
| Metin/biçim | ✓ 1.0 | ✓ 1.0 | – |
| Görünürlük | ✓ 1.0 | ✗ 0 | – |
| İçerik uyarısı | ✓ 1.0 | ✗ 0 | – |
| Etiketler | ✓ 1.0 | ✓ 1.0 | – |
| Bahsetmeler | ◐ 0.5 | ✗ 0 | – |
| Alıntı | ✗ 0 | ✗ 0 | – |
| Medya | ✓ 1.0 | ◐ 0.5 | – |
| Alt-metin | ◐ 0.5 | ✓ 1.0 | – |
| Yanıt/iplik | ✓ 1.0 | ✗ 0 | – |
| Zaman | ✓ 1.0 | ✓ 1.0 | – |
| Dil | ✗ 0 | ✗ 0 | – |
| **Ortalama** | **0.75** | **0.46** | **–** |

## Yön Asimetrisi (RQ1) — çıkış ≠ giriş

> Aynı (boyut × protokol) için çıkış ve giriş skorunun farklı olduğu hücreler.
> Bunlar protokol model farkının en somut kanıtı.

| Boyut | Protokol | Çıkış | Giriş | Fark |
|---|---|---|---|---|
| Kimlik | AT Protocol (Bluesky) | ◐ 0.5 | ✓ 1.0 | ↑ giriş daha iyi |
| Metin/biçim | AT Protocol (Bluesky) | ◐ 0.5 | ✓ 1.0 | ↑ giriş daha iyi |
| Alıntı | ActivityPub (Mastodon) | ✓ 1.0 | ✗ 0 | ↓ çıkış daha iyi |
| Medya | ActivityPub (Mastodon) | ✗ 0 | ✓ 1.0 | ↑ giriş daha iyi |
| Alt-metin | ActivityPub (Mastodon) | ✗ 0 | ◐ 0.5 | ↑ giriş daha iyi |
| Zaman | AT Protocol (Bluesky) | ◐ 0.5 | ✓ 1.0 | ↑ giriş daha iyi |
| Dil | AT Protocol (Bluesky) | ◐ 0.5 | ✗ 0 | ↓ çıkış daha iyi |

7 asimetrik hücre.

**Öne çıkanlar:**
- **Medya / AP:** çıkışta kayıp (`buildNote` ek koymaz), girişte tam (`attachRemoteMediaAndPreview`) → floq medyayı *alır ama vermez*.
- **Zaman / Bluesky:** çıkışta crosspost anı, girişte orijinal `record.createdAt` → giriş daha sadık.
- **Metin / Bluesky:** çıkışta kırpma (300), girişte tam → asimetrik kayıp.

## Gerekçeler ve kod alıntıları

### Kimlik — *Yazarın aynı/bağlı kimlikle temsili*
- **ActivityPub (Mastodon)** `✓ 1.0`: fetchRemoteActor ile uzak yazar tam kimliğiyle çözülür. _(`ingestRemoteNote: fetchRemoteActor(attributedTo)`)_
- **AT Protocol (Bluesky)** `✓ 1.0`: Kullanıcının kendi floq aktörü altında aynalanır (aynı kişi). _(`importBlueskyPosts: authorId = actor.id`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Metin/biçim — *Gövde metni + biçimlendirme korunması*
- **ActivityPub (Mastodon)** `✓ 1.0`: note.content tam HTML olarak saklanır. _(`ingestRemoteNote: content = note.content`)_
- **AT Protocol (Bluesky)** `✓ 1.0`: record.text olduğu gibi alınır (Bluesky zaten düz metin) — kayıp yok. _(`importBlueskyPosts: content = record.text`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Görünürlük — *public/unlisted/followers/direct semantiği*
- **ActivityPub (Mastodon)** `✓ 1.0`: to/cc'den görünürlük çözülür. _(`ingestRemoteNote: resolveVisibility(to, cc)`)_
- **AT Protocol (Bluesky)** `✗ 0`: Daima public olarak eklenir (Bluesky görünürlük modeli yok). _(`importBlueskyPosts: visibility = public`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### İçerik uyarısı — *CW/sensitive bayrağı + özet*
- **ActivityPub (Mastodon)** `✓ 1.0`: summary + sensitive korunur. _(`ingestRemoteNote: contentWarning = note.summary, sensitive`)_
- **AT Protocol (Bluesky)** `✗ 0`: Bluesky self-label okunmuyor → CW yok. _(`importBlueskyPosts: label okunmaz`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Etiketler — *Makine-okunur hashtag*
- **ActivityPub (Mastodon)** `✓ 1.0`: Hashtag tag'leri okunur. _(`ingestRemoteNote: note.tag Hashtag → tags`)_
- **AT Protocol (Bluesky)** `✓ 1.0`: Metinden regex ile çıkarılıp floq tag'lerine yazılır. _(`importBlueskyPosts: matchAll(/#.../) → tags`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Bahsetmeler — *Makine-okunur @mention*
- **ActivityPub (Mastodon)** `◐ 0.5`: Yalnızca Hashtag okunur; Mention tag düşer (@ metinde kalır). _(`ingestRemoteNote: yalnızca Hashtag filtrelenir`)_
- **AT Protocol (Bluesky)** `✗ 0`: Mention facet okunmuyor. _(`importBlueskyPosts: mention parse edilmez`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Alıntı — *Alıntılı paylaşım bağlantısı*
- **ActivityPub (Mastodon)** `✗ 0`: ingestRemoteNote alıntı (FEP-e232) çözmez (gerçek-zamanlı inbox Create kısmen çözebilir). _(`ingestRemoteNote: quotedPostId set edilmez`)_
- **AT Protocol (Bluesky)** `✗ 0`: Alıntı embed'i içe aktarılmaz. _(`importBlueskyPosts: quote yok`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Medya — *Görsel ek(ler)i*
- **ActivityPub (Mastodon)** `✓ 1.0`: attachRemoteMediaAndPreview ile medya (hotlink) eklenir. _(`ingestRemoteNote: attachRemoteMediaAndPreview(note)`)_
- **AT Protocol (Bluesky)** `◐ 0.5`: Görseller hotlink (max 4); video yok. _(`importBlueskyPosts: extractBskyimages (images, slice 4)`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Alt-metin — *Erişilebilirlik alt-metni*
- **ActivityPub (Mastodon)** `◐ 0.5`: Alt-metin attachRemoteMediaAndPreview eşlemesine bağlı (kısmi). _(`attachRemoteMediaAndPreview`)_
- **AT Protocol (Bluesky)** `✓ 1.0`: Görsel alt-metni korunur. _(`importBlueskyPosts: altText = im.alt`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Yanıt/iplik — *Yanıt bağlamı / thread*
- **ActivityPub (Mastodon)** `✓ 1.0`: inReplyTo çözülür, gerekirse zincir yukarı ingest edilir. _(`ingestRemoteNote: inReplyTo → replyToId/rootId`)_
- **AT Protocol (Bluesky)** `✗ 0`: Yanıtlar hiç içe aktarılmaz (posts_no_replies filtresi). _(`importBlueskyPosts: filter posts_no_replies; record.reply skip`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Zaman — *Orijinal oluşturma zamanı*
- **ActivityPub (Mastodon)** `✓ 1.0`: note.published orijinal zaman korunur. _(`ingestRemoteNote: createdAt = note.published`)_
- **AT Protocol (Bluesky)** `✓ 1.0`: record.createdAt — Bluesky'deki ORİJİNAL zaman korunur. _(`importBlueskyPosts: createdAt = record.createdAt`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

### Dil — *Dil etiketi*
- **ActivityPub (Mastodon)** `✗ 0`: Dil etiketi saklanmaz. _(`ingestRemoteNote: language alanı yok`)_
- **AT Protocol (Bluesky)** `✗ 0`: Bluesky langs okunmuyor. _(`importBlueskyPosts: langs okunmaz`)_
- **Nostr** `–`: Nostr→floq import implement edilmedi (inbound köprü yok). _(`—`)_

