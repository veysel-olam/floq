# floq — Savunma Soru-Cevap (SSS)

> Jüri savunması için hazırlık notları. Her sorunun altında **detaylı cevap** ve **15 saniyelik sözlü özet** var.
> Proje: floq — çok protokollü federe sosyal ağ. Veysel OLAM, Amasya Üniversitesi.

---

## 1. floq neden yapıldı?

Bugünün sosyal ağları **merkezi**: tek bir şirket verini, kimliğini ve gördüğün içeriği kontrol ediyor. Hesabın kapanırsa takipçilerini, gönderilerini, sosyal grafiğini kaybedersin — taşıyamazsın. İçeriğini kimin göreceğine bir algoritma karar verir; kurallar yukarıdan dayatılır. floq bu üç soruna cevap olarak yapıldı:

- **Veri sahipliği** — verin sende; dışa aktarabilir, başka sunucuya taşıyabilirsin.
- **Kilitsizlik (exit hakkı)** — beğenmezsen kimliğin ve takipçilerinle birlikte ayrılırsın.
- **Açık birlikte çalışabilirlik** — tek bir protokole hapsolmadan Mastodon, Bluesky ve Nostr ağlarıyla **aynı anda** konuşabilen tek bir hesap.

Ek olarak floq, akademik bir katkı sunuyor: üç ayrı federasyon protokolünü (ActivityPub, AT Protocol, Nostr) tek bir kimlik altında köprüleyen ve bunun üstüne **konfederal topluluk** katmanı ekleyen bir referans implementasyonu.

> **15 sn:** Merkezi sosyal ağlarda veri, kimlik ve algoritma tek şirketin elinde. floq; veri sahipliği, kilitsizlik ve protokoller-arası çalışabilirlik için yapıldı — üç federe ağa aynı anda konuşan, taşınabilir bir hesap.

---

## 2. Neden federe?

**Federasyon**, bağımsız sunucuların ortak bir protokolle (e-posta gibi) birbiriyle konuşmasıdır. Tek bir merkez yoktur; herkes kendi sunucusunu kurabilir ve hepsi aynı ağın parçası olur. Federe olmamızın nedenleri:

- **Tek hata/kontrol noktası yok** — bir sunucu çökse veya kötü yönetilse, ağ yaşamaya devam eder.
- **Ölçek ve erişim** — floq tek başına küçük olsa bile, federasyon sayesinde Mastodon evrenindeki **binlerce sunucu** ve milyonlarca kullanıcıyla anında konuşur. Sıfırdan kullanıcı kitlesi kurmak zorunda değilim.
- **Standart üzerine inşa** — W3C'nin **ActivityPub** standardını kullanıyoruz; tekerleği yeniden icat etmeden mevcut fediverse'e katılıyoruz.
- **Öz-yönetim** — her sunucu kendi kurallarını koyar; tek tip global sansür yoktur.

floq teknik olarak: gelen/giden **Activity** (Create/Follow/Announce/Like/Delete) işleyen bir inbox/outbox, **WebFinger** ile keşif, **HTTP Signatures** ile sunucular-arası kimlik doğrulama yapar.

> **15 sn:** Federe = bağımsız sunucular ortak protokolle (ActivityPub) konuşur, tıpkı e-posta gibi. Tek merkez yok, tek hata noktası yok; ve floq daha ilk günden fediverse'teki binlerce sunucuya bağlı.

---

## 3. Neden konfederal? (Nesi konfederal?)

Federasyon, **sunucular** seviyesinde birleşmedir. floq bunun **bir üstüne** bir katman koyar: **topluluklar arası konfederasyon**. Yani topluluklar (floq'ta birer ActivityPub *Group*), bağımsızlıklarını koruyarak gönüllü **ittifaklar** kurar.

Konfederal yapan somut özellikler (hepsi implement edildi):

- **Topluluk ittifakları** (`communityPartnerships`) — iki topluluk karşılıklı onayla ortaklık kurar.
- **Konfederasyon oylaması** (`confederationVotes`) — ittifak kararları üyelerin/moderatörlerin oyuyla alınır; merkezi bir otorite dayatmaz.
- **Paylaşılan güven & rozetler** (`communityTrustRecord`, `communityBadges`) — bir toplulukta kazanılan güven, ittifak içindeki diğer topluluklarda da geçerli olabilir.

**Federasyon ile fark:** Federasyonda sunucular *teknik olarak* birbirine bağlanır ama her topluluk yalnızdır. Konfederasyonda topluluklar *siyasi/sosyal olarak*, **egemenliklerini kaybetmeden** birleşir — tıpkı bağımsız kantonların oluşturduğu bir konfederasyon gibi. Her topluluk istediği zaman ittifaktan çıkabilir; merkez yoktur, sadece eşitler arası anlaşma vardır.

> **15 sn:** Federasyon sunucuları bağlar; konfederasyon ise toplulukları bağlar. floq'ta topluluklar egemenliklerini koruyarak ittifak kurar, ortak oy verir, güveni ve rozetleri paylaşır — bağımsız kantonların konfederasyonu gibi.

---

## 4. Biri sakıncalı içerik paylaşınca ne yapılacak?

Merkeziyetsiz bir ağda tek bir "sil" düğmesi yoktur; bu yüzden **katmanlı** bir süreç işler:

1. **Bildirim (report)** — herhangi bir kullanıcı içeriği şikâyet eder.
2. **Otomatik gizleme** — bir içerik belli sayıda (örn. 5) bağımsız şikâyet alınca otomatik olarak görünürlükten kaldırılır ve moderatör kuyruğuna düşer.
3. **Moderatör incelemesi & modlog** — topluluk moderatörleri / sunucu yöneticisi karar verir; her işlem **şeffaf moderasyon kaydına** (`communityModlog`) yazılır.
4. **Sunucu düzeyi** — yasa dışı içerik (özellikle çocuk istismarı/CSAM gibi) için sıfır tolerans; içerik kaldırılır, hesap kapatılır, gerekirse yetkililere bildirilir.
5. **Defederasyon** — kötü içerik *başka* bir sunucudan geliyorsa, o sunucu **bloklanır/defedere edilir**; tüm ağı temizlemek zorunda değilsin, kendi sınırını çizersin.

Anahtar fikir: Merkeziyetsizlikte amaç "her yerden silmek" değil — **her sunucunun/topluluğun kendi sınırını koyabilmesi**. İçerik bir sunucudan silinse de federe kopyaları başka sunucularda kalabilir; bu, dağıtık sistemin doğal bir sonucudur ve dürüstçe kabul edilir.

> **15 sn:** Şikâyet → eşik aşılınca otomatik gizleme → moderatör kararı + şeffaf modlog → yasa dışı içerikte (CSAM vb.) sıfır tolerans → kötü kaynak başka sunucuysa defederasyon. Merkeziyetsizlikte amaç her yerden silmek değil, her topluluğun kendi sınırını çizebilmesi.

---

## 5. Moderasyon yapısı bu sistemlerde nasıl?

Merkeziyetsiz moderasyon **katmanlıdır** — yetki tek elde değil, dağıtılmıştır:

- **Kullanıcı düzeyi** — herkes bireysel araçlara sahiptir: engelle, sustur, şikâyet et, kelime filtresi.
- **Topluluk düzeyi** — her topluluğun kendi moderatörleri (`communityModerators`), kendi kuralları (wiki), kendi rozet/flair sistemi ve şeffaf modlog'u vardır.
- **Sunucu (instance) düzeyi** — sunucu yöneticisi (`actor.role = admin`) tüm sunucu için politika belirler; yasa dışı içeriği kaldırır, hesapları yönetir, başka sunucuları defedere eder.
- **Konfederal düzey** — ittifak içindeki topluluklar paylaşılan güven listeleri ve ortak kararlarla birbirini destekler.

Bu yapı, merkezi platformların "tek şirket = tek hakem" modelinin tersidir: **öznel/kültürel kararlar topluluğa**, **yasal/teknik kararlar sunucuya** bırakılır. Böylece hem yerel özerklik hem de yasal sorumluluk korunur.

floq'taki roller: `user` → `moderator` → `admin` (`actor_role` enum). Admin paneli sunucu genelinde moderasyon görünürlüğü sağlar.

> **15 sn:** Moderasyon dört katmanlı: kullanıcı (engelle/sustur), topluluk (kendi moderatörleri+modlog), sunucu (admin, yasal/teknik), konfederal (ittifaklar). Tek hakem yok; kültürel kararlar topluluğa, yasal kararlar sunucuya dağıtılır.

---

## 6. floq kapansa hesaplara ne olur?

floq tek bir sunucuda (Hetzner) barınıyor; o sunucu kalıcı kapanırsa **oradaki canlı veri gider** — bu her tek-sunuculu serviste böyledir. Ama federasyon, kullanıcıyı **kilitli bırakmaz**; kapanmadan önce çıkış yolları vardır:

1. **Hesap taşıma (ActivityPub `Move`)** — hesabını başka bir fediverse sunucusuna taşırsın; **takipçilerin seninle gelir**. Kimliğin ve sosyal grafiğin yaşamaya devam eder.
2. **Veri dışa aktarma** — gönderilerini, takip listeni, profilini **JSON arşivi** olarak istediğin an indirirsin.
3. **Federe kopya** — dışarı federe olmuş public gönderilerin, takipçilerinin sunucularında durur.

Yani merkezi platformdaki "her şey buharlaşır + sosyal grafiği kaybedersin" durumu yerine, **önceden taşı/dışa aktar** ilkesi geçerlidir.

> **15 sn:** Tek sunucu kapanırsa canlı veri gider — ama kullanıcı kilitli değil: kapanmadan önce hesabını takipçileriyle başka sunucuya taşıyabilir (ActivityPub Move) veya verisini JSON olarak indirebilir. Sosyal grafiğini kaybetmez.

---

## 7. Neden merkeziyetsizlik?

- **Veri sahipliği** — verin tek şirketin sunucusunda rehin değil; taşınabilir, dışa aktarılabilir.
- **Sansür/keyfilik direnci** — tek otorite seni kapatamaz, algoritmayla manipüle edemez.
- **Dayanıklılık** — tek hata/kontrol noktası yok; bir sunucu çökse ağ yaşar.
- **Öz-yönetim** — kurallar yukarıdan dayatılmaz; topluluk/sunucu kendi koyar.
- **Açık rekabet & yenilik** — isteyen sunucu açıp protokole katılır; yenilik tekele bağlı değildir.
- **Exit hakkı** — beğenmezsen taşınırsın; "çıkış" gerçek bir seçenektir.

> **15 sn:** Merkeziyetsizlik = veri sahipliği + sansür direnci + dayanıklılık + öz-yönetim + gerçek çıkış hakkı. Tek şirket seni kapatamaz, verini rehin alamaz, algoritmayla yönlendiremez.

---

## 8. floq kapandıktan sonra kullanıcı verilerine yine erişebilir mi?

Duruma göre — ve bu, "veri sahipliği = **taşınabilirlik**" ilkesinin özüdür:

- **Dışa aktardıysa** → evet, JSON arşivi elinde (gönderiler, takipler, medya bağlantıları).
- **Hesabını taşıdıysa** → evet, hesabı+takipçileri yeni sunucuda yaşar.
- **İkisini de yapmadıysa ve sunucu kalıcı kapandıysa** → hayır, yalnız o sunucudaki canlı veriye erişemez.

**Dürüst nokta:** Veri sahipliği ≠ sonsuz erişim garantisi; **araçların kullanıcıda olması** demektir (export + Move). floq bu araçları verir; sorumluluk/güç kullanıcıdadır. Daha derin katman olarak floq, sunucudan bağımsız kriptografik kimlik üretir: **DID:key** (AT Protocol için) ve **Nostr anahtar çifti**. Bu anahtarlar sunucu kapansa bile kullanıcıya aittir — kimliğini koruyabilirsin. Tam "her zaman erişilebilir veri" için içeriğin de relay/dağıtık depoda olması gerekir; floq bunun temelini (Nostr relay'lerine yayım) atar.

> **15 sn:** Export veya hesap taşıma yaptıysa evet, verisi yine elinde. Hiçbirini yapmadıysa o sunucudaki canlı veri erişilemez olur. Veri sahipliği "sonsuz hosting garantisi" değil, "taşıyabilme aracı"dır — ve floq DID/Nostr ile sunucudan bağımsız kimlik de verir.

---

## 9. Üye verileri nerede saklanıyor?

flq.social prod ortamı: tek bir **Hetzner** sunucusunda, **Docker** konteynerleri içinde:

- **PostgreSQL 17** — hesaplar, gönderiler, takipler, beğeniler, topluluklar (sunucudaki `postgres_data` kalıcı volümünde).
- **MinIO (S3-uyumlu)** — medya: avatar, kapak, gönderi görsel/video (`floq-media` bucket, `minio_data` volümü).
- **Redis 7** — önbellek ve iş kuyruğu (geçici/ephemeral).

**Güvenlik:** Tüm özel anahtarlar (ActivityPub actor, Nostr, Bluesky token'ları) **AES-256 ile şifreli** saklanır (`ENCRYPTION_KEY` master key, [keys.ts](apps/api/src/lib/keys.ts)); şifreler **Better Auth ile hash'li**. Ayrıca public gönderilerinin bir kopyası, federe olduğu **uzak sunucularda** da bulunur (federasyonun doğası). **Self-host** edersen veri tamamen senin kontrolündeki sunucuda olur.

> **15 sn:** Tek Hetzner sunucusunda, Docker içinde: PostgreSQL (veriler), MinIO (medya), Redis (kuyruk). Özel anahtarlar AES-256 şifreli, şifreler hash'li. Public gönderilerin kopyası federe sunucularda da var.

---

## 10. "Hetzner sunucusunda saklanıyor" — güvenliği ve hesap güvenliği nerede? Gerçekten özgür müyüz?

Bu, projenin en kritik ve en dürüst yanıtı gereken sorusu. Üç ayrı başlıkta cevaplıyorum:

### a) Sunucu/altyapı güvenliği
- **Şifreli iletişim** — tüm trafik TLS/HTTPS (Caddy otomatik sertifika).
- **Konteyner izolasyonu** — her servis (API, DB, MinIO, Redis) ayrı Docker konteynerinde; DB/Redis dışarıya kapalı, yalnız iç ağdan erişilir.
- **Şifreli sırlar** — özel anahtarlar veritabanında **AES-256-CBC** ile şifreli; düz metin tutulmaz.
- **Sunucular-arası kimlik doğrulama** — federe istekler **HTTP Signatures** ile imzalanır; sahte sunucu taklidi engellenir.
- **Hız sınırlama & fail2ban** — kaba kuvvet ve flood saldırılarına karşı.

### b) Hesap güvenliği
- **Better Auth** — endüstri standardı oturum yönetimi; şifreler **hash'li** (düz metin değil).
- **Şifreli kimlik anahtarları** — kullanıcının kriptografik kimliği (ActivityPub/Nostr/DID) sunucuda şifreli saklanır.
- **Yetki katmanları** — `user/moderator/admin` rolleriyle yetki sınırlandırması.

### c) "Gerçekten özgür müyüz?" — dürüst cevap
İşte savunmada en güçlü duracak nokta, çünkü **nüansı kabul ediyoruz**:

> Tek bir flq.social sunucusu, *pratikte* hâlâ merkezîdir — onu **ben** (yönetici) işletirim. O sunucudaki kullanıcılar **bana güvenmek** zorundadır; tıpkı herhangi bir Mastodon sunucusunda yöneticiye güvenmek gibi. Yani floq **"güvensiz/trustless"** bir sistem **değildir**.

Peki özgürlük nerede? **Üç düzeyde:**
1. **Protokol açık** — beğenmezsen kendi floq/Mastodon sunucunu kurar, aynı ağa katılırsın. Bana mahkûm değilsin.
2. **Veri taşınabilir** — hesabını (Move) ve verini (export) alıp çıkabilirsin. **Exit hakkı = özgürlüğün asıl garantisi.**
3. **Kilit ve algoritma yok** — kurumsal kilitlenme, gözetim reklamı veya manipülatif algoritma yoktur.

Yani floq'un özgürlük iddiası "**bana güvenmek zorunda değilsin**" değil — "**istediğin an, kimliğini ve verini kaybetmeden ayrılabilirsin**"dir. Tam egemenliğe (sunucu yöneticisine bile güvenmemek) giden yol ise **self-hosting** ve **sunucudan bağımsız kriptografik kimlik** (DID/Nostr anahtarları): floq her ikisini de destekler. Merkezi platformlarda bu seçeneklerin **hiçbiri** yoktur.

> **15 sn:** Sunucu güvenliği: TLS, konteyner izolasyonu, AES-256 şifreli anahtarlar, HTTP Signatures, fail2ban. Hesap güvenliği: Better Auth, hash'li şifre, rol katmanları. Özgürlük sorusunda dürüstüm: tek sunucu pratikte merkezîdir, yöneticiye güvenirsin — ama merkezi platformdan farkı, **istediğin an kimliğin ve verinle ayrılabilmen**. Tam egemenlik için self-host + DID/Nostr kimliği var. Özgürlük "güvenmek zorunda değilsin" değil, "kilitli değilsin"dir.

---

## 11. Sitede çocuk koruması nasıl çalışıyor?

floq'ta çocuk koruması **kayıttan itibaren, kodda zorunlu** çalışır — sadece bir politika metni değil:

- **Yaş kapısı (kayıtta)** — kayıt sırasında doğum yılı zorunlu olarak alınır ([auth.ts](apps/api/src/lib/auth.ts)). **13 yaşından küçükler kesin reddedilir** (hesap oluşturulmaz; COPPA/KVKK uyumlu yaklaşım).
- **Reşit olmayan (13-17) kısıtlı mod** — `isMinor` bayrağı açılır ve şu kısıtlamalar **kodda** uygulanır:
  - **Arama motoru indekslemesi kapalı** (`noIndex`) — profili dışarıya açık dizine girmez.
  - **Hassas/NSFW içerik gizlenir** — reşit olmayan kullanıcının akışında `sensitive` gönderiler filtrelenir ([timeline.ts:329](apps/api/src/routes/timeline.ts#L329)).
  - **Konum paylaşımı engellenir** — gönderilerine coğrafi konum eklenemez ([posts.ts:152](apps/api/src/routes/posts.ts#L152)).
  - **DM koruması** — reşit olmayan birine doğrudan mesaj gönderimi engellenir ([dm.ts:226](apps/api/src/routes/dm.ts#L226)).
- **CSAM (çocuk istismarı içeriği) — sıfır tolerans** — ayrı bir şikâyet kategorisidir (`report_reason = 'csam'`); en yüksek öncelikle ele alınır, içerik kaldırılır, hesap kapatılır ve yetkililere bildirim esastır. Federe gelen böyle içerik için kaynak sunucu **defedere** edilir.

> **15 sn:** Kayıtta doğum yılı zorunlu; 13 altı kesin reddedilir, 13-17 "kısıtlı mod"a girer — indekslenmez, hassas içerik görmez, konum paylaşamaz, kendisine DM atılamaz. CSAM ayrı kategori, sıfır tolerans + defederasyon.

---

## 12. Bir üye taciz ederse site nasıl muamele ediyor?

Katmanlı bir süreç işler — hem **anlık kullanıcı araçları** hem de **moderatör yaptırımı**:

1. **Anlık kullanıcı araçları** — kurban beklemeden kendini korur: **engelle, sustur, şikâyet et** (`harassment` kategorisi var).
2. **Şikâyet kaydı** — şikâyet `reports` tablosuna düşer (sebep + detay + durum: `pending`); moderatör/admin kuyruğunda görünür.
3. **Moderatör incelemesi** — admin paneli `/api/admin/reports` üzerinden şikâyet kabul/ret eder, not düşer; her karar **`admin_audit_logs`'a** kaydedilir (şeffaflık).
4. **Yaptırım** — gerekirse içerik etiketlenir/kaldırılır veya kullanıcı **askıya alınır** (`user.suspend`). Kullanıcıya askı bildirimi gider.
5. **İtiraz hakkı** — askıya alınan kullanıcı **itiraz** edebilir (`/api/v1/reports/:id/appeal`); itirazlar ayrı kuyrukta admin tarafından onay/ret edilir — keyfîliğe karşı denge.
6. **Federe taciz** — taciz başka sunucudan geliyorsa o **kullanıcı/sunucu engellenir veya defedere edilir**; ayrıca **paylaşılan blok listeleri** (`block_lists`) ile tehdit topluca süzülebilir.

> **15 sn:** Kurban anında engelle/sustur/şikâyet eder. Şikâyet moderatör kuyruğuna düşer, denetim günlüğüyle incelenir; gerekirse içerik kaldırılır veya kullanıcı askıya alınır. Askıya itiraz hakkı var. Federe tacizde defederasyon + paylaşılan blok listeleri.

---

## 13. Türkiye'den bir yasak (içerik kaldırma talebi) gelirse ne olur?

Bu, federe mimarinin **hem gücünü hem sınırını** gösteren dürüst bir sorudur. Cevap, yasağın **neyi hedeflediğine** göre değişir:

- **Yasa dışı içeriğe yönelik meşru talep** (mahkeme kararı vb.) — sunucu yöneticisi olarak **flq.social üzerindeki** ilgili içeriği kaldırır / hesabı askıya alır. Sunucu Türkiye yargı yetkisindeyse bu yasal bir yükümlülüktür ve karşılanır (denetim günlüğüne işlenir).
- **Ama federasyon "tek düğmeyle her yerden silme"yi imkânsız kılar** — içerik zaten başka sunuculara federe olduysa, o kopyalar **kendi yargı bölgelerindeki** sunucularda kalır; Türkiye'nin yetkisi flq.social ile sınırlıdır, tüm fediverse'i kapsamaz. Bu, **sansüre karşı doğal direnç** sağlar.
- **Tüm siteye erişim engeli (IP/DNS yasağı)** gelirse — flq.social Türkiye'den erişilemez olabilir, **ama kullanıcılar kilitli kalmaz:** hesaplarını başka ülkedeki bir fediverse sunucusuna **taşıyabilir** (ActivityPub `Move`), verilerini **dışa aktarabilir**, VPN/Tor veya kendi **self-host** sunucularıyla ağa katılmaya devam edebilir. Merkezi platformda "site yasaklandı = bittin"; federe ağda yasak **tek bir kapıyı** kapatır, ağı değil.

Özetle: Meşru/yasal taleplere kendi sunucumuz düzeyinde uyulur; ama merkeziyetsiz yapı, **tek bir otoritenin tüm ağ üzerinde mutlak silme/engelleme gücü kurmasını** yapısal olarak engeller.

> **15 sn:** Meşru yasal talep gelirse flq.social'daki içeriği kaldırırız (yargı yetkisi sunucuya uygulanır). Ama federasyon "her yerden sil"i imkânsız kılar — kopyalar başka ülkelerin sunucularında kalır. Tüm siteye erişim yasaklanırsa kullanıcı kilitli kalmaz: hesabını başka sunucuya taşır, verisini indirir, self-host eder. Yasak tek kapıyı kapatır, ağı değil.

---

## 14. Admin birini engellerse o veriye ne olur? Kullanıcı gerçekten özgür mü? Merkeziyetsizlik burada ne işlev görüyor?

### Engellenen veriye ne olur?
floq'ta admin "engelleme"si **yumuşak askıya almadır** (`isSuspended = true`), **veriyi yok etmez** ([admin.ts:408](apps/api/src/routes/admin.ts#L408)):
- Hesap ve tüm içerik **veritabanında durur**; askı **geri alınabilir** (`unsuspend` ile aynen geri gelir).
- Yani admin, içeriği **görünürlükten kaldırır** ama **mülkiyetini gasbetmez/silmez**. Bu, "kalıcı silme = sansür" ile "askı = denetlenebilir, geri döndürülebilir tedbir" arasındaki kritik farktır. Her askı **denetim günlüğüne** yazılır.

### Kullanıcı gerçekten özgür mü? (dürüst cevap)
Tek bir flq.social sunucusunda admin (ben), o sunucuda **gerçek bir yetkiye** sahibim — askıya alabilirim. Yani **o sunucu içinde** kullanıcı admin'e tabidir; bu inkâr edilmez. floq "yöneticisiz/güvensiz (trustless)" bir sistem **değildir**.

**Özgürlük başka yerde:** Kullanıcı **bu sunucuya mahkûm değildir.**
- **Exit hakkı** — askıya alınsa bile (veya almadan önce) hesabını başka sunucuya **taşır** (`Move`, takipçileriyle) ve verisini **dışa aktarır**. Admin onu o sunucudan çıkarabilir ama **ağdan veya kimliğinden koparamaz.**
- **Açık protokol** — beğenmezse kendi sunucusunu kurar, aynı ağa eşit olarak katılır.
- **Sunucudan bağımsız kimlik** — DID:key + Nostr anahtarları kullanıcıya aittir; sunucu onları geri alamaz.

### Merkeziyetsizlik burada ne işlev görüyor?
Tam olarak **gücü dengelemek**: Merkezi platformda admin'in yasağı *mutlaktır* — kimliğin, takipçilerin, verin hepsi gider, itiraz edemezsin, başka yere taşıyamazsın. Merkeziyetsizlikte admin'in yetkisi **kendi sunucusuyla sınırlıdır**; kullanıcının elinde **çıkış, taşıma ve kendi sunucusunu kurma** karşı-gücü vardır. Yani özgürlük "hiç kural/yönetici yok" değil — **"hiçbir yöneticinin üzerinde mutlak güç kuramaması"**dır. Merkeziyetsizlik, yaptırımı ortadan kaldırmaz; onu **tek elde toplanmaktan** alıkoyar.

> **15 sn:** Admin "engelleme"si yumuşak askıdır — veri silinmez, geri alınabilir, denetim günlüğüne yazılır. Kullanıcı o sunucuda admin'e tabidir (floq trustless değil), ama sunucuya mahkûm değildir: hesabını taşır, verisini indirir, kendi sunucusunu kurar. Merkeziyetsizliğin işlevi yaptırımı yok etmek değil, hiçbir yöneticinin mutlak güç kurmasını engellemek — özgürlük "kural yok" değil, "kilit yok"tur.

---

*Hazırlayan: Veysel OLAM — floq bitirme projesi. Son güncelleme: 2026-06-05.*
