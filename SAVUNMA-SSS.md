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

*Hazırlayan: Veysel OLAM — floq bitirme projesi. Son güncelleme: 2026-06-05.*
