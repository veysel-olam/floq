# Anlamsal Kayıp Matrisi — floq Çıkış Köprüleri (Katman 1: Statik)

> Otomatik üretildi (`research/interop/audit.ts`) · 2026-06-05
> Skor: `✓ 1.0` tam · `◐ 0.5` kısmi · `✗ 0` kayıp · `–` n/a
> Kapsam: floq → hedef (çıkış), gönderi nesnesi.

| Boyut | ActivityPub (Mastodon) | AT Protocol (Bluesky) | Nostr |
|---|---|---|---|
| Kimlik | ✓ 1.0 | ◐ 0.5 | ◐ 0.5 |
| Metin/biçim | ✓ 1.0 | ◐ 0.5 | ◐ 0.5 |
| Görünürlük | ✓ 1.0 | ✗ 0 | ✗ 0 |
| İçerik uyarısı | ✓ 1.0 | ✗ 0 | ✗ 0 |
| Etiketler | ✓ 1.0 | ✓ 1.0 | ✓ 1.0 |
| Bahsetmeler | ◐ 0.5 | ✗ 0 | ✗ 0 |
| Alıntı | ✓ 1.0 | ✗ 0 | ✗ 0 |
| Medya | ✗ 0 | ◐ 0.5 | ✗ 0 |
| Alt-metin | ✗ 0 | ✓ 1.0 | ✗ 0 |
| Yanıt/iplik | ✓ 1.0 | ✗ 0 | ✗ 0 |
| Zaman | ✓ 1.0 | ◐ 0.5 | ◐ 0.5 |
| Dil | ✗ 0 | ◐ 0.5 | ✗ 0 |
| **Ortalama** | **0.71** | **0.38** | **0.21** |

## Boyut kırılganlığı (hedefler ortalaması — düşük = kırılgan)

| Boyut | Ort. korunma |
|---|---|
| Bahsetmeler | 0.17 |
| Medya | 0.17 |
| Dil | 0.17 |
| Görünürlük | 0.33 |
| İçerik uyarısı | 0.33 |
| Alıntı | 0.33 |
| Alt-metin | 0.33 |
| Yanıt/iplik | 0.33 |
| Kimlik | 0.67 |
| Metin/biçim | 0.67 |
| Zaman | 0.67 |
| Etiketler | 1.00 |

## Gerekçeler ve kod alıntıları

### Kimlik — *Yazarın aynı/bağlı kimlikle temsili*
- **ActivityPub (Mastodon)** `✓ 1.0`: Gönderi aynı floq actor URL'sine attributedTo — kimlik birebir. _(`buildNote: attributedTo = actorUrl(author.handle)`)_
- **AT Protocol (Bluesky)** `◐ 0.5`: Kullanıcının ayrı Bluesky hesabı (app-password) altında çıkar; floq↔Bluesky kimliği kriptografik olarak bağlı değil. _(`crosspostToBluesky: stored connection agent`)_
- **Nostr** `◐ 0.5`: floq'un ürettiği ayrı npub; floq handle'ına yalnızca NIP-05 ile gevşek bağlı. _(`crosspostToNostr → publishNote (ayrı anahtar)`)_

### Metin/biçim — *Gövde metni + biçimlendirme korunması*
- **ActivityPub (Mastodon)** `✓ 1.0`: Tam HTML içerik korunur. _(`buildNote: content = post.content`)_
- **AT Protocol (Bluesky)** `◐ 0.5`: HTML soyulur + 300 karaktere kırpılır. _(`crosspostToBluesky: replace(/<[^>]+>/g) + slice(0,300)`)_
- **Nostr** `◐ 0.5`: HTML soyulur; biçim/bağlantı yapısı düz metne iner. _(`crosspostToNostr: replace(/<[^>]+>/g)`)_

### Görünürlük — *public/unlisted/followers/direct semantiği*
- **ActivityPub (Mastodon)** `✓ 1.0`: public/unlisted/followers → to/cc doğru eşlenir. _(`buildNote: to/cc by post.visibility`)_
- **AT Protocol (Bluesky)** `✗ 0`: Bluesky tüm gönderiler herkese açık; floq görünürlüğü taşınmaz (yalnızca public/unlisted zaten crosspost edilir). _(`crosspostToBluesky: görünürlük alanı yok`)_
- **Nostr** `✗ 0`: Nostr tümü herkese açık; görünürlük semantiği yok. _(`crosspostToNostr: görünürlük alanı yok`)_

### İçerik uyarısı — *CW/sensitive bayrağı + özet*
- **ActivityPub (Mastodon)** `✓ 1.0`: sensitive + summary (CW) taşınır. _(`buildNote: note.sensitive + note.summary`)_
- **AT Protocol (Bluesky)** `✗ 0`: Bluesky self-label kullanılmıyor; CW kaybolur. _(`crosspostToBluesky: label/sensitive yok`)_
- **Nostr** `✗ 0`: NIP-36 content-warning tag'i kullanılmıyor. _(`crosspostToNostr: cw tag yok`)_

### Etiketler — *Makine-okunur hashtag*
- **ActivityPub (Mastodon)** `✓ 1.0`: Hashtag tag'leri eklenir. _(`buildNote: tagArr Hashtag`)_
- **AT Protocol (Bluesky)** `✓ 1.0`: richtext facet (#tag) olarak eklenir. _(`crosspostToBluesky: facets (app.bsky.richtext.facet#tag)`)_
- **Nostr** `✓ 1.0`: `t` tag'lerine eşlenir. _(`crosspostToNostr: hashtags → [t, tag]`)_

### Bahsetmeler — *Makine-okunur @mention*
- **ActivityPub (Mastodon)** `◐ 0.5`: buildNote Mention tag eklemez; @ yalnızca metinde kalır → makine-okunur değil (alıcı çıkarabilir). _(`buildNote: tagArr'da Mention yok`)_
- **AT Protocol (Bluesky)** `✗ 0`: mention facet eklenmez. _(`crosspostToBluesky: yalnızca tag facet`)_
- **Nostr** `✗ 0`: `p` (pubkey) mention tag'i eklenmez. _(`crosspostToNostr: p tag yok`)_

### Alıntı — *Alıntılı paylaşım bağlantısı*
- **ActivityPub (Mastodon)** `✓ 1.0`: FEP-e232: quoteUri/quoteUrl/_misskey_quote + Link tag. _(`buildNote: post.quotedApId → quote alanları`)_
- **AT Protocol (Bluesky)** `✗ 0`: app.bsky.embed.record (quote) eşlemesi yok. _(`crosspostToBluesky: quote embed yok`)_
- **Nostr** `✗ 0`: NIP-18 quote / `q` tag yok. _(`crosspostToNostr: quote yok`)_

### Medya — *Görsel ek(ler)i*
- **ActivityPub (Mastodon)** `✗ 0`: buildNote gönderi medyasını attachment olarak eklemez (yalnızca actor profil alanları için attachment var). _(`buildNote: obj.attachment yalnızca actor.profileFields`)_
- **AT Protocol (Bluesky)** `◐ 0.5`: Görseller embed edilir (max 4); video taşınmaz; 4'ten fazlası düşer. _(`crosspostToBluesky: uploadImageToBluesky, images.slice(0,4)`)_
- **Nostr** `✗ 0`: Medya gömülmez (imeta/URL yok). _(`crosspostToNostr: medya yok`)_

### Alt-metin — *Erişilebilirlik alt-metni*
- **ActivityPub (Mastodon)** `✗ 0`: Medya taşınmadığı için alt-metin de yok. _(`buildNote: medya yok`)_
- **AT Protocol (Bluesky)** `✓ 1.0`: Gönderilen görsellerde alt-metin korunur. _(`crosspostToBluesky: { image, alt: m.alt }`)_
- **Nostr** `✗ 0`: Medya yok → alt yok. _(`crosspostToNostr: medya yok`)_

### Yanıt/iplik — *Yanıt bağlamı / thread*
- **ActivityPub (Mastodon)** `✓ 1.0`: inReplyTo ile yanıt bağlamı korunur. _(`buildNote: note.inReplyTo = post.apInReplyTo`)_
- **AT Protocol (Bluesky)** `✗ 0`: Yanıtlar zaten crosspost edilmez; edilse de thread'siz düz gönderi olur. _(`posts.ts: yalnızca !replyToId crosspost; record'da reply yok`)_
- **Nostr** `✗ 0`: `e` (event) reply tag'i eklenmez. _(`crosspostToNostr: e tag yok`)_

### Zaman — *Orijinal oluşturma zamanı*
- **ActivityPub (Mastodon)** `✓ 1.0`: published = orijinal createdAt. _(`buildNote: published = post.createdAt`)_
- **AT Protocol (Bluesky)** `◐ 0.5`: record.createdAt = crosspost anı (orijinal değil); gecikmede sapar. _(`crosspostToBluesky: createdAt = new Date()`)_
- **Nostr** `◐ 0.5`: created_at = yayın anı (orijinal değil). _(`publishNote: created_at = Date.now()/1000`)_

### Dil — *Dil etiketi*
- **ActivityPub (Mastodon)** `✗ 0`: buildNote dil/contentMap alanı set etmez. _(`buildNote: language alanı yok`)_
- **AT Protocol (Bluesky)** `◐ 0.5`: langs sabit ['tr'] — gerçek dil tespit edilmez. _(`crosspostToBluesky: langs: ['tr']`)_
- **Nostr** `✗ 0`: Dil etiketi yok. _(`crosspostToNostr: dil tag yok`)_

## Okuma notları
- **AP en yüksek korunma** — floq native AP konuşur; `buildNote` çoğu boyutu taşır. Başlıca açık: **medya** (gönderi eki federe edilmiyor).
- **Bluesky orta** — etiket/medya/alt iyi; görünürlük, CW, alıntı, yanıt, dil kaybı belirgin.
- **Nostr en lossy** — yalnızca metin + hashtag; yapısal her şey (görünürlük, CW, alıntı, medya, yanıt, mention) düşer.
- **Asimetri (RQ1):** Bu matris yalnızca çıkış (floq→X). Giriş (X→floq, `importBlueskyPosts`) ayrı bir matris gerektirir; yön asimetrisi orada görünür.
