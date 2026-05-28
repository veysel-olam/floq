# floq — Topluluklar: Analiz ve Fikir Havuzu

> Bu dosya topluluklar özelliğine dair rekabet analizi, mevcut durum değerlendirmesi
> ve gelecek fikir havuzunu tutar. Kararlaştırılanlar ROADMAP.md'ye taşınır.

---

## Konfederal Yapı Nedir?

Her topluluk kendi kurallarını, kültürünü ve moderasyonunu özerk olarak yönetir.
Hiçbir merkezi otorite toplulukları yönetemez. Ama topluluklar **gönüllü ittifaklar** kurabilir:
içerik köprüleri açabilir, ortak güven ağları paylaşabilir, birlikte karar alabilirler.

Bu ActivityPub'ın zaten tasarlandığı model — her `Group` actor bağımsız bir birlik,
`Follow` aktivitesi iki topluluk arasında ittifak kuruyor.

---

## Roadmap

### Faz 0 — Temel Tamamlama ✅ / 🔧
*"Mevcut altyapıyı üretime hazır hale getir"*

**Zaten tamamlanan:**
- Topluluk CRUD (oluştur, düzenle, sil)
- Görünürlük: public / restricted / private
- Üye ol / ayrıl, katılım onayı
- Moderatör atama / görevden alma
- ActivityPub Group actor (federe altyapı)
- Topluluk feed'i (`groupId` ile bağlı gönderiler)
- Üye listesi, bekleyen istekler
- Topluluk keşif sayfası (UI: grid, arama, filtre)
- Topluluk oluşturma sayfası

**Eksik — Faz 0'ı kapatmak için:**

| Görev | Dosya | Notlar |
|---|---|---|
| `/c/[handle]` profil sayfası | `web/src/app/(app)/c/[handle]/page.tsx` | Feed + üyeler + ayarlar sekmesi |
| Sabitlenmiş gönderi (pin) | `api/routes/groups.ts` + `posts` tablosu | `pinned_community_post_id` → `apGroups` |
| Toplu davet linki | `api/routes/groups.ts` | Token bazlı `/join?token=xxx` |
| Topluluk profil sayfası moderasyon paneli | UI | Bekleyen istekler, üye listesi, banlama |

---

### Faz 1 — Özerk Topluluk
*"Her topluluk bağımsız bir birim olarak ayakta durabilmeli"*

**Hedef:** Topluluk sahiplerine kendi alanlarını tam kontrol etme imkânı.

#### 1.1 Post Şablonları (Structured Posts)
Topluluklar özel gönderi formatları tanımlar. Üye o formatta gönderi atar. floq'ta zengin kart olarak render edilir, federe platformlara plain text olarak düşer.

```
ap_groups tablosuna: post_templates JSONB
posts tablosuna: template_id UUID, structured_data JSONB
```

**Örnek şablon — Fotoğrafçılar topluluğu:**
```json
{
  "name": "Fotoğraf Paylaşımı",
  "icon": "📷",
  "fields": [
    { "key": "camera", "label": "Kamera", "type": "text" },
    { "key": "lens", "label": "Objektif", "type": "text" },
    { "key": "settings", "label": "ISO / Diyafram / Perde", "type": "text" },
    { "key": "story", "label": "Bu kareyi anlat", "type": "textarea" }
  ]
}
```

#### 1.2 Topluluk Wiki
Her topluluğun düzenlenebilir, sabit bir bilgi sayfası. Reddit'in sidebar'ından daha güçlü — sürüm geçmişi var, moderatörler düzenleyebilir.

```
community_wiki tablosu: community_id, content TEXT, edited_by, edited_at, version INT
```

#### 1.3 Moderasyon Şeffaflık Logu
Hangi moderatörün hangi postu kaldırdığı, hangi üyeyi banladığı. Kamuya açık (veya sadece üyelere). Mastodon ve Bluesky'de yok. Güçlü bir şeffaflık özelliği.

```
community_modlog tablosu: id, community_id, actor_id (mod), action ENUM, target_id, reason, created_at
```

#### 1.4 Topluluk Tipleri
`community_type` enum: `general | book | film | music | gaming | tech | art | science | sport`
Tip seçince o türe uygun hazır post şablonları öneriliyor. Aşama 1.1'in üstüne basit bir katman.

---

### Faz 2 — Güven Sicili
*"Kazanılmış, taşınabilir, demokratik itibar"*

**Hedef:** Topluluklar üyelerine ActivityPub üzerinden taşınabilir rozetler versin.

#### 2.1 Katkı Takibi
Her topluluğun üyesi için katkı skoru. Gönderi sayısı değil, onaylanan katkı sayısı (diğer üyeler boost/endorse ediyor).

```
community_contributions tablosu:
  actor_id, community_id, post_id, endorsed_by[], score INT, created_at
```

#### 2.2 Rozet Tanımları
Topluluk sahibi rozet tanımlar: isim, kriter (minimum onaylı katkı sayısı, minimum üyelik süresi, mod oyu eşiği).

```
community_badges tablosu:
  id, community_id, name, icon, description, criteria_json, created_at
```

#### 2.3 Rozet Verme / İptal
Moderatörler veya topluluk oyuyla rozet verilir. ActivityPub `Award` aktivitesi olarak yayınlanır. Rozet alıcının profilinde görünür.

```
actor_badges tablosu:
  id, actor_id, badge_id, granted_at,
  evidence_post_ids UUID[],
  vote_count INT,
  revoked_at TIMESTAMP, -- null = aktif
  ap_id VARCHAR(2048)   -- ActivityPub nesnesi URL'i
```

#### 2.4 Profil Entegrasyonu
Kullanıcı profilinde "Topluluk Rozetleri" bölümü. Federe platformlara `actor.attachment` array'ine eklenerek taşınır.

---

### Faz 3 — Konfederasyon
*"Topluluklar birbirini tanır, içerik ve güven paylaşır"*

**Hedef:** Özerk toplulukların gönüllü ittifak kurabildiği konfederal yapı.

#### 3.1 Topluluk İttifakı (Partnership)
Bir topluluk diğerine ittifak teklifi gönderir. İkisi de kabul ederse partnership aktif. ActivityPub `Follow` aktivitesi iki Group actor arasında bu ilişkiyi kuruyor — altyapı zaten var.

```
community_partnerships tablosu:
  id, community_a_id, community_b_id,
  status ENUM(pending | active | rejected),
  initiated_by UUID,
  created_at
```

**Görsel:** Topluluk sayfasında "Müttefik Topluluklar" bölümü — ittifak kurduğu toplulukların küçük kartları.

#### 3.2 Konfedere İçerik Köprüsü
İttifak kurulunca opsiyonel: topluluk A'nın öne çıkan gönderileri topluluk B'nin "Müttefik" sekmesinde görünür. Takip edilmeden keşif imkânı.

Uygulama: `GET /api/communities/:handle/allied-feed` endpoint'i — ittifak kurduğu toplulukların yüksek etkileşimli gönderilerini döner.

#### 3.3 Konfedere Güven
Eğer topluluk A ile topluluk B ittifak kurmuşsa, A'nın "Küratör" rozetini taşıyan biri B'de de görünür olarak işaretlenir (üst badge gösterimi). B'nin ayrıca teyit etmesi gerekmez — ittifak yeterli.

#### 3.4 Topluluklar Arası Öneri / Oylama
Bir topluluk diğerine oylama teklifi gönderebilir: "Ortak etkinlik düzenleyelim mi?", "Ortak kural ekleyelim mi?" Her topluluğun üyeleri kendi platformunda oy kullanır. Sonuçlar birleştirilir.

```
confederation_votes tablosu:
  id, initiator_community_id, target_community_ids UUID[],
  title, description, options JSONB,
  closes_at TIMESTAMP, results JSONB
```

---

### Faz 4 — Evrensel Federasyon
*"Fediverse ekosistemiyle tam entegrasyon"*

**Hedef:** floq toplulukları, Lemmy grupları ve diğer AP tabanlı topluluk platformlarıyla şeffaf şekilde çalışsın.

#### 4.1 Lemmy Grup Federasyonu
ActivityPub `Group` actor tipi zaten uyumlu. Eksik olan:
- Lemmy'den gelen `Announce` aktivitelerini doğru işlemek
- floq topluluğunu Mastodon/Lemmy'den takip etmeyi test etmek
- `GET /c/[handle]` profil sayfasını AP endpoint olarak düzgün sunmak

#### 4.2 Uzak Topluluk Keşfi
Topluluk arama sayfasında sadece yerel değil, federe topluluklarda da arama. `GET /api/communities?remote=true&q=fotografci`

#### 4.3 Topluluk Referans Mektubu
Faz 2 (Güven Sicili) tamamlanınca: üye iş başvurusu veya başka bir ağa geçiş için moderatör imzalı, AP doğrulanabilir referans belgesi endpoint'i.

```
GET /api/communities/:handle/endorsements/:actorHandle
→ Activity Streams 2.0 belge, HTTP Signature ile imzalı
```

---

## Uygulama Sırası Özeti

```
Faz 0 (şimdi)     → /c/[handle] profil sayfası + pin + davet linki
Faz 1 (sonraki)   → Post şablonları + wiki + modlog + topluluk tipleri
Faz 2 (orta vade) → Güven sicili + rozet sistemi + profil entegrasyonu
Faz 3 (büyük iş)  → İttifak + içerik köprüsü + konfedere oylama
Faz 4 (uzun vade) → Lemmy federasyonu + uzak keşif + referans mektubu
```

Her faz bir öncekinin üstüne inşa edilir.
Faz 3'ün güçlü çalışması için Faz 2'nin rozet altyapısı hazır olmalı.
Faz 4 büyük ölçüde Faz 0'daki AP altyapısının doğru çalışmasına bağlı.

---

## Rekabet Analizi

### Mastodon

Mastodon'da gerçek anlamda "topluluk" kavramı **yoktur**.

- **Instance modeli** — belirli bir ilgi alanına adanmış sunucular (mastodon.art, fosstodon.org) defacto topluluk gibi davranıyor. Ama bu üyelik değil, ayrı sunucuya taşınmak demek.
- **Hashtag takibi** — en yaygın topluluk proxy'si. Merkezi değil, organize değil.
- **Lemmy federasyonu** — Mastodon'dan `@topluluk@lemmy.ml` takip edilerek içerik alınabiliyor. Mastodon'un kendi özelliği değil, dışarıdan geliyor.

**Sonuç:** Grup/topluluk altyapısı zayıf. "Instance = topluluk" metaforu hem büyük hem küçük ölçekte kötü deneyim veriyor.

---

### Bluesky

Bluesky topluluk kavramını **algoritmik** olarak tanımlıyor:

- **Starter Packs** — "Bu 20 kişiyi takip et, bu 3 feed'i abone ol" şeklinde paketlenmiş giriş noktaları. Bağlayıcı değil, herkes dağınık.
- **Custom Feeds** — AT Protocol üstünde özel feed'ler. Feed = topluluk gibi davranıyor ama ortak paylaşım alanı yok. Herkes kendi profilinde paylaşıyor.
- **Lists** — Manuel kişi listeleri, besleme kaynağı olarak kullanılabiliyor.
- **Communities (beta)** — 2025'te duyuruldu, hâlâ sınırlı erişimde. Reddit/Discord benzeri ayrı alan planlıyor.

**Sonuç:** Topluluklar feed etrafında şekilleniyor. Aynı içerik havuzu paylaşılıyor ama ortak bir "alan" yok.

---

### Floq — Mevcut Durum

| Özellik | Durum |
|---|---|
| Topluluk oluşturma (handle, isim, açıklama) | ✅ |
| Görünürlük: public / restricted / private | ✅ |
| Üye ol / Ayrıl | ✅ |
| Katılım onayı (restricted mod) | ✅ |
| Moderatör atama | ✅ |
| Topluluk feed'i (gönderiler `groupId` ile bağlı) | ✅ |
| Banner URL, renk indeksi (0-7), konular, kurallar | ✅ |
| Üye listesi + moderatör listesi | ✅ |
| ActivityPub Group actor (federe) | ✅ |
| Bekleyen üye istekleri (pending join) | ✅ |
| Topluluk içi gönderi | ✅ |

Bu tablo Mastodon'un hiç olmayan ve Bluesky'nin henüz beta'da olan şeyinden **bugün daha güçlü** bir altyapıyı gösteriyor.

**Eksik özelleştirme:** `apGroups` tablosuna bakınca mevcut özelleştirme yalnızca kozmetik:
- `banner_url`, `color_index` (0-7), `topics` (metin), `rules` (metin)
- Topluluk tipi yok
- Post şablonu yok
- Üye rozeti yok

---

## Fikirler

### 1. Topluluk Güven Sicili ⭐ Ana Fikir

**Sorun:** İnternette kimin ne bildiğini anlamak imkânsız.
- Twitter'da mavi tik = para ödeyen
- LinkedIn'de endorsement = birinin bir düğmeye bastığı
- Reddit'te karma = eskimiş içerikle şişirilmiş, platform dışında sıfır
- Stack Overflow puanı = platform içinde sıkışmış, taşınamaz

**Fikir:** Bir topluluğa kaliteli katkı yapan üyeler, o topluluğun kolektif onayıyla **kazanılmış, taşınabilir rozetler** alır.

Bu rozetler:
- ActivityPub nesnesi olarak federe — floq dışında, Mastodon'da, Bluesky'da görünür
- Kriptografik olarak topluluk tarafından imzalı — sahtecilik yok
- Somut katkılara bağlı — "47 topluluk onaylı gönderi" şeklinde değil, soyut değil
- Topluluk oyuyla geri alınabilir — kötü davranış varsa iptal
- Açık kaynak denetlenebilir — arka planda manüpülasyon yok

**Örnek akış:**

```
@elif, 2 yıldır #fotografcilar topluluğuna katkıda bulunuyor
→ 67 gönderi topluluk üyeleri tarafından onaylandı
→ Topluluk oyu: 31/40 ile "Küratör" rozeti verildi
→ Bu rozet ActivityPub nesnesi olarak @elif'in profilinde

@elif başka bir topluluğa katıldığında:
→ "Fotoğrafçılar Topluluğu'nda Küratör · floq.social" görünüyor
→ Tüm fediverse kullanıcıları bunu görebiliyor
```

**Neden sadece floq yapabilir:**

| Gereksinim | floq | Twitter | Reddit | LinkedIn |
|---|---|---|---|---|
| Topluluk tarafından verilmeli | ✅ | ❌ | ❌ | ❌ |
| Federe / taşınabilir (ActivityPub) | ✅ | ❌ | ❌ | ❌ |
| Açık kaynak / denetlenebilir | ✅ | ❌ | ❌ | ❌ |
| Katkıya bağlı, somut | ✅ | ❌ | kısmen | ❌ |
| Geri alınabilir, demokratik | ✅ | ❌ | ❌ | ❌ |

**Global kullanım alanları:**
- Dezenformasyon karşıtı: "Bu kişi 3 sağlık topluluğunun güvenilir sesi" bağlamı içerik yanında görünüyor
- Mesleki kredibilite: "5 açık kaynak topluluğunun güvenilir katkıcısı" — CV'deki "Python biliyorum"dan farklı bir şey
- Gazetecilik: Topluluklar tarafından onaylanmış muhabir. Algoritmik büyütme yerine organik otorite
- Eğitim: Öğrenciler tarafından kurulmuş bir topluluğun "En İyi Anlatıcı" rozeti. Resmi diploma dışı, ama gerçek

**Üst düzey uzantı:** Topluluk Referans Mektubu
> Bir üye iş başvurusu yaparken "Bu topluluktaki katkılarımı referans göstermek istiyorum" der.
> Moderatörler ActivityPub imzalı, doğrulanabilir metin üretir.
> İşveren `https://floq.com/communities/acik-kaynak/endorsements/@elif` adresine gidip orijinalliği kontrol eder.
> Decentralized professional credentialing — LinkedIn'in yapamayacağı bir şey.

**Şema taslağı:**
```sql
-- Rozet tanımları (topluluk başına)
community_badges (
  id uuid,
  community_id uuid → ap_groups,
  name varchar(100),         -- "Küratör", "Uzman Katkıcı"
  description text,
  criteria_json jsonb,       -- minimum katkı sayısı, oylama eşiği vs.
  created_at timestamp
)

-- Verilen rozetler (ActivityPub Award nesnesi)
actor_badges (
  id uuid,
  actor_id uuid → actors,
  badge_id uuid → community_badges,
  granted_at timestamp,
  evidence_post_ids uuid[],  -- hangi gönderiler gerekçe
  vote_count int,
  revoked_at timestamp,      -- null = aktif
  ap_id varchar(2048)        -- ActivityPub nesnesi URL'i
)
```

---

### 2. Post Şablonları (Structured Posts)

**Fikir:** Topluluk sahipleri özel post şablonları tanımlar. Şablon = formu tanımlayan JSON. Üye o topluluğa gönderi atarken şablonu seçip doldurur.

Örnek — Fotoğrafçılar topluluğu için "Fotoğraf Paylaşımı" şablonu:
```json
{
  "name": "Fotoğraf Paylaşımı",
  "fields": [
    { "key": "camera", "label": "Kamera", "type": "text" },
    { "key": "lens", "label": "Objektif", "type": "text" },
    { "key": "settings", "label": "ISO / Diyafram / Perde", "type": "text" },
    { "key": "location", "label": "Konum", "type": "text" },
    { "key": "story", "label": "Bu kareyi anlat", "type": "textarea" }
  ]
}
```

Şablonla doluturulmuş gönderi floq'ta zengin kart olarak render edilir. Federe platformlara plain text olarak düşer (graceful degradation).

**Şema taslağı:**
```sql
-- Topluluk başına şablon tanımları
post_templates (
  id uuid,
  community_id uuid → ap_groups,
  name varchar(100),
  icon varchar(10),          -- emoji
  schema_json jsonb,         -- field tanımları
  is_required boolean,       -- o topluluğa gönderi için zorunlu mu
  created_at timestamp
)

-- Gönderi başına doldurulmuş şablon verisi
posts tablosuna:
  template_id uuid → post_templates,
  structured_data jsonb
```

---

### 3. Kısa Vadeli, Yüksek Değer

Bunlar büyük fikir değil ama hızlı implement edilir, topluluk yöneticilerinin en çok şikayetçi olduğu şeyler:

| Özellik | Değer | Zorluk |
|---|---|---|
| Sabitlenmiş gönderi (pin) | Duyuru ve önemli içerik | Düşük |
| Toplu davet linki | Büyüme için kritik | Düşük |
| Federe topluluk keşfi (Lemmy) | Ekosistem bağlantısı | Orta |
| Topluluk haftalık özeti | Pasif üyeyi geri getiriyor | Orta |
| Alt başlıklar / kanallar | Reddit flair / Discord kanal | Yüksek |
| Topluluk wiki | Sabit, düzenlenebilir bilgi sayfası | Yüksek |
| Moderasyon şeffaflık logu | Hangi mod neyi kaldırdı | Orta |

---

### 4. Topluluk Tipleri (İkincil Yol)

Güven Sicili + Post Şablonları'nın yanında ek olarak düşünülebilir. Topluluk tipine göre hazır şablon önerilir.

Planlanan tipler:
- `book` — Kitap İncelemesi, Okuma Challenge'ı
- `film` — Film Kartı, İzleme Listesi
- `music` — Albüm Değerlendirmesi, Playlist
- `gaming` — Oyun Kartı, Başarım Paylaşımı
- `tech` — Proje Tanıtımı, Kod İncelemesi
- `art` — Eser Galerisi, Teknik Notlar
- `science` — Makale Özeti, Araştırma Tartışması
- `default` — Genel topluluk

---

## Öncelik Sırası

1. **Topluluk Güven Sicili** — ana differentiator, globally unique, ActivityPub altyapısı hazır
2. **Post Şablonları** — topluluk kalitesini artırır, şablon sistemi Güven Sicili'ni de besler
3. **Sabitlenmiş gönderi + Davet linki** — küçük iş, büyük pratik değer
4. **Federe topluluk keşfi (Lemmy)** — ekosistemin kapısını açıyor
5. **Topluluk Tipleri** — Post Şablonları hazır olunca kolaylaşıyor

---

## Notlar

- Güven Sicili implementasyonu için ActivityPub `Award` aktivitesi tanımlanmalı (AP spec'te mevcut, kullanılmıyor)
- Post Şablonları'nın ActivityPub uyumu: `structured_data` → `attachment` array olarak federe edilebilir
- Her iki özellik de "açık kaynak + federe" kimliğini doğrudan güçlendiriyor
- Topluluk Tipleri, Post Şablonları implement edildikten sonra sadece UI meselesi haline geliyor
