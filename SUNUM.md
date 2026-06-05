# floq — Bitirme Savunması Sunum Kılavuzu

> 20 dakika + canlı demo (flq.social, projeksiyon). Teknik jüri.
> Bu dosya: süre planı, 12 ana slayt (tam konuşma metniyle), demo betiği,
> 7 yedek slayt (dolu içerik) ve jüri-sorusu kalkanı.
> **Konuşma notlarını ezberleme — aynen oku.** Slayt başına tek mesaj.

---

## Süre Bütçesi

| Bölüm | Slayt | Süre |
|---|---|---|
| Açılış + Problem + Çözüm | 1–3 | ~4 dk |
| Nasıl çalışır (mimari + federasyon + köprüler) | 4–6 | ~5 dk |
| **CANLI DEMO** | demo | ~5 dk |
| Güvenlik + Mühendislik dersleri | 7–8 | ~3 dk |
| Katkılar + Kısıtlar + Kapanış | 9–12 | ~3 dk |
| Yedek (appendix) — soru gelince | A1–A7 | — |

Toplam ~20 dk. Demo'yu slayt 6'dan sonra koy: teoriyi dinleyen jüri çalışan sistemi görünce ikna olur.

---

# ANA DECK (12 slayt)

> Her slaytta üstte küçük "argüman adımı" etiketi olsun: **Problem → Çözüm → Nasıl → Kanıt → Titizlik → Katkı**. Jüri nerede olduğunu hep bilsin.

---

### Slayt 1 — Kapak · *[Açılış]*
- **floq** — Çok-protokollü, federe sosyal ağ
- [Adın] · [Bölüm] · Danışman: [Ad] · 2026

🗣️ *"Merhaba, ben [ad]. Bitirme projem floq: kendi sunucunuzda çalışan, üç farklı sosyal ağ protokolünü birbirine bağlayan bir sosyal ağ. 20 dakikada hem nasıl çalıştığını anlatacağım hem de canlı göstereceğim."*

---

### Slayt 2 — Problem · *[Problem]*
- Merkezi platformlar: veriniz sizde değil, algoritma kapalı kutu, platforma kilitlisiniz
- Merkeziyetsiz alternatifler var **ama birbirini görmüyor** — Mastodon, Bluesky, Nostr ayrı adalar
- 🖼️ Görsel: birbirine bakmayan 3 ada

🗣️ *"Bugün iki kötü seçenek var. Ya Twitter gibi merkezi platformlara mahkûmuz — verimiz bizde değil. Ya da Mastodon, Bluesky, Nostr gibi özgür alternatifler var ama bunlar birbiriyle konuşamıyor; her biri ayrı bir ada. Kullanıcı birinde olunca diğerlerini kaçırıyor."*

---

### Slayt 3 — Çözüm: floq · *[Çözüm]*
- Üç protokolü tek sunucuda köprüler: **ActivityPub + AT Protocol (Bluesky) + Nostr**
- Modern, tüketici-dostu arayüz + **kendi-barındırılabilir** (self-hostable)
- *Ne değil:* sıradan bir Mastodon klonu değil — bir **köprü + ağ**

🗣️ *"floq bu üç adayı tek köprüde birleştiriyor. floq'taki bir kullanıcı, Mastodon'daki ve Bluesky'deki birini aynı yerden takip edip etkileşebiliyor. Üstelik bunu modern, günlük kullanıma uygun bir arayüzle yapıyor ve isteyen kendi sunucusunda çalıştırabiliyor."*

---

### Slayt 4 — Sistem Mimarisi · *[Nasıl]*
- Web: **Next.js** · API: **Fastify** · Veritabanı: **PostgreSQL**
- Kuyruk/önbellek: **Redis + BullMQ** · Paketleme: **Docker**
- 🖼️ Üst düzey kutu diyagramı

🗣️ *"Mimaride önyüz Next.js, arka uç Fastify, veritabanı PostgreSQL. Önemli nokta şu: federasyon mesajları doğrudan değil, arka planda bir kuyrukla teslim ediliyor. Böylece bir sunucu yavaşsa veya çökse bile sistem ayakta kalıyor, mesaj kaybolmuyor."*

---

### Slayt 5 — Federasyon Nasıl Çalışır · *[Nasıl]*
- **WebFinger** (kullanıcı keşfi) → **HTTP Signatures** (kimlik doğrulama) → **inbox/outbox** (mesaj teslimi)
- Kütüphane değil — **protokolü sıfırdan implemente ettim**

🗣️ *"Federasyonun kalbi şu üç adım: önce WebFinger ile uzak kullanıcıyı buluyoruz, sonra her isteği imzayla doğruluyoruz, sonra gönderileri karşı sunucunun gelen kutusuna teslim ediyoruz. Bunu hazır bir kütüphaneyle değil, protokolü okuyup kendim yazarak yaptım — yani floq gerçekten Mastodon ağıyla konuşuyor."*

---

### Slayt 6 — Köprüler + Döngü Koruması · *[Nasıl — özgünlüğün kalbi]*
- **Bluesky çift yönlü:** floq→Bluesky paylaş **+** Bluesky→floq içe aktar
- **Nostr** köprüsü
- En zor problem: **loop guard** — aynı içerik köprüde sonsuza dek dönmesin

🗣️ *"İşte projenin en özgün kısmı. Bluesky köprüsü iki yönlü: floq'a yazdığınız Bluesky'ye gidiyor, Bluesky'de yazdığınız floq'a geliyor. Buradaki asıl mühendislik zorluğu döngüyü engellemekti — içerik köprüde sonsuza dek gidip gelmesin diye her gönderiye bir kimlik işaretleyip kendi çıktımı tanıyan bir koruma yazdım."*

---

### Slayt 7 — CANLI DEMO · *[Kanıt]*
- Büyük başlık: **Demo · flq.social**
- 🖼️ 4 küçük yedek ekran görüntüsü: akış / Moment / Köprüler / federe gönderi
- *(İnternet çökerse buradaki görüntülerden devam et)*

🗣️ *"Şimdi en güzel kısma geçelim — bu bir maket değil, flq.social adresinde gerçekten canlı. İzninizle birkaç dakika gezdireyim."* → **(demo betiğine geç, aşağıda)**

---

### Slayt 8 — Güven & Güvenlik · *[Titizlik]*
- **Çocuk koruma**: 13 yaş sınırı + 13–17 kısıtlı mod
- **CSAM** rapor kategorisi · **şeffaflık raporu** (aylık, herkese açık)
- **Blok/rapor federasyonu** — sinyaller uzak sunuculara da gider

🗣️ *"Bir sosyal ağ işletmek sorumluluk demek. O yüzden yaş korumasını, kötüye-kullanım raporlamayı ve aylık şeffaflık raporunu en baştan tasarladım. Engelleme ve rapor sinyalleri sadece floq'ta kalmıyor, federe ağa da iletiliyor."*

---

### Slayt 9 — Mühendislik Dersleri · *[Titizlik]*
- Gerçek olaylar: yakalanıp kapatılan **güvenlik açığı** (kimlik üzerine yazma)
- Şema değişiminde **migration disiplini** · canlı federasyon hata ayıklama

🗣️ *"Proje boyunca gerçek sorunlarla karşılaştım. Mesela bir güvenlik açığını — yetkisiz birinin yerel hesabı bozabilmesini — fark edip kapattım. Veritabanı değişikliklerini canlıda güvenle uygulama disiplinini sahada öğrendim. Bunlar projenin en öğretici kısmıydı; kod yazmaktan çok sistem düşünmeyi öğretti."*

---

### Slayt 10 — Katkılar · *[Katkı — en kritik slayt]*
1. Üç protokolü **native köprüleyen** referans implementasyon
2. **Çift yönlü** Bluesky köprüsü + loop guard
3. **Federe trust & safety** (moderasyon sinyali yayılımı)
4. **Çalışan, dağıtılmış** sistem — sadece prototip değil

🗣️ *"Özetle dört somut katkı: üç protokolü tek üründe native köprülemek, çift yönlü Bluesky köprüsü, federe ortamda çalışan bir güvenlik katmanı ve bunların hepsinin gerçekten canlıda çalışması. Tek bir mainstream ağ bu üç protokolü bir arada sunmuyor — fark burada."*

---

### Slayt 11 — Kısıtlar & Gelecek İş · *[Katkı — olgunluk]*
- **Dürüst sınırlar:** kitlesel ölçek hedeflenmedi; niş + tek geliştirici
- **Bilimsel sonraki adım:** protokoller-arası **anlamsal kayıp ölçümü** (bkz. A6)
- Gelecek: video köprü, yanıt aktarımı, etkileşim geri akışı

🗣️ *"Sınırlarımı da açıkça söyleyeyim: bu bir kitlesel ürün değil, bir referans implementasyon — ölçek hedefim olmadı. Asıl bilimsel adım ise şu: iki protokol köprülenirken hangi bilgi kayboluyor, bunu ölçmek. Bu, projenin bir araştırma katkısına dönüştüğü nokta."*

---

### Slayt 12 — Kapanış · *[Kapanış]*
- **"Flow together, own your data."**
- flq.social · Teşekkürler

🗣️ *"Özetle floq, merkeziyetsiz sosyal ağların dağınıklığına tek-sunucu bir köprü öneriyor — hem çalışan bir sistem hem de ölçülebilir bir araştırma sorusu olarak. Dinlediğiniz için teşekkür ederim; sorularınızı memnuniyetle alırım."*

---

# CANLI DEMO BETİĞİ (~5 dk, sırayı bozma)

Kaybolmamak için **sabit rota**:

1. **Ana akış** (10s) — "Bu gerçek, canlı sistem."
2. **Gönderi at** (40s) — yaz → paylaş → akışta **anında** görün. ("Sayfa yenilemeye gerek yok.")
3. **Federe gönderi** (60s) — Keşfet'te başka sunucudan (Mastodon) gelen bir gönderi göster. "Bu floq'ta yazılmadı, başka bir sunucudan geldi."
4. **Köprüler sekmesi** (60s) — Bluesky bağlantısı + "Son senkron" durumu. "floq Bluesky'ye de uzanıyor, durumunu görebiliyoruz."
5. **Moment + müzik kartı** (40s) — tüketici tarafı: hikâye + müzik paylaşımı.
6. **Kapat** (20s) — "Gördüğünüz her şey canlı sistemde, gerçek zamanlı."

**Yedek plan:** İnternet/çökme → Slayt 7'deki ekran görüntülerine geç, *"kısa bir ağ sorunu, ekran görüntülerinden devam edeyim"* de, panikleme.
**Altın ipucu:** Demoyu **önceden ekran kaydına al**; canlı çökerse videoyu oynat — kaygıyı sıfırlar.

---

# YEDEK SLAYTLAR (Appendix — gösterme, soru gelince aç)

### A1 — Detaylı Mimari
- Caddy (reverse proxy + TLS) → web (Next.js) / api (Fastify)
- PostgreSQL 17 · Redis 7 (BullMQ kuyrukları: federation delivery, crosspost, moment expiry)
- MinIO (S3-uyumlu medya) · Docker Compose · GitHub Actions CI/CD (Hetzner)
- 🗣️ *"Soru gelirse: her şey Docker'da; Caddy önde TLS ve yönlendirme yapıyor, medya MinIO'da, işler Redis kuyruklarında."*

### A2 — Karşılaştırma Tablosu

| Özellik | **floq** | Mastodon | Bluesky | Bridgy Fed | Hubzilla/streams |
|---|---|---|---|---|---|
| Protokol sayısı | **3** (AP+ATProto+Nostr) | 1 (AP) | 1 (ATProto) | köprü servisi | çok (Zot+AP) |
| Köprü | **native, gömülü** | yok | yok | harici servis | kısmi |
| Kimlik modeli | yerel + DID:web + Nostr anahtarı | @user@instance | DID + PDS | — (köprüler) | nomadic identity |
| Moderasyon | yerel+federe blok/rapor, çocuk koruma, şeffaflık | yerel+federe | merkezî-ish + labeler | yok | yerel |
| Self-host | **evet** | evet | zor (PDS+AppView) | hayır | evet |
| Tüketici UX (story/müzik/editör) | **evet** | sınırlı | sınırlı | yok | eski/teknik |
| Açık kaynak | evet | evet | evet | evet | evet |

- 🗣️ *"Farkım tabloda net: tek satırda üç protokol + native köprü + modern UX'i bir arada sunan başka satır yok. Bridgy Fed köprülüyor ama harici bir servis, kendi ağı yok; Hubzilla çok-protokollü ama Bluesky/Nostr yok ve arayüz eski."*

### A3 — Güvenlik Açığı Vaka Çalışması
- **Neydi:** Uzak-aktör tazeleme akışı, yerel aktörü de tazeleyebiliyordu → kimliği bozma (handle/is_local üzerine yazma) → hesap erişilemez.
- **Nasıl bulundu:** Kendi profilim 404 verince izledim.
- **Çözüm:** `if (existing?.isLocal) return existing` — yerel aktör asla uzak veriyle ezilmez; ayrıca inbox'ta "spoofed local actor" reddi.
- **Sınıf:** Kimlik doğrulama gerektirmeyen DoS vektörü (veri çalma değil).
- 🗣️ *"Soru gelirse: bu, kimlik tazelemede bir mantık hatasıydı; yerel hesabı koruyan bir guard ve gelen sahte-yerel aktör reddiyle kapattım."*

### A4 — Veri Modeli (özet)
- `users`, `actors` (yerel+uzak), `posts` (görünürlük, AP id, `bsky_uri`), `follows`, `likes`, `boosts`
- `bluesky_connections` (crosspost/import + durum), `reports`, `media_attachments`, `flows`, `notifications`
- 🗣️ *"Soru gelirse: gönderiler ve aktörler merkezde; köprü durumu ve moderasyon ayrı tablolarda."*

### A5 — Desteklenen AP Aktiviteleri + FEP
- Create/Note, Follow/Accept, Like, Announce (boost), Delete/Tombstone, Update, Move, Block, Flag, EmojiReact, Question (anket)
- FEP-8b32 (imzalı nesne), FEP-c7d3, FEP-e232 (quote), FEP-5feb (noindex)
- 🗣️ *"Soru gelirse: temel aktivitelerin hepsi + birkaç FEP uzantısı; quote ve reaksiyon dahil."*

### A6 — Bilimsel Deney Tasarımı (interop anlamsal kayıp)
- **Araştırma sorusu:** AP ↔ AT Protocol ↔ Nostr köprülenirken hangi anlamsal bilgi ne ölçüde korunur?
- **Boyutlar:** kimlik, görünürlük (public/unlisted/followers), metin/biçim, hashtag, mention, quote, medya+alt-text, reaksiyon/beğeni, yanıt/thread, zaman damgası, moderasyon sinyali (CW/sensitive, delete)
- **Yöntem:** her boyut için kanonik test gönderileri üret → floq'tan üç hedefe gönder/al → köprü sonrası nesneyi orijinalle **alan-alan** otomatik karşılaştır
- **Metrik:** her (boyut × protokol-çifti) için korunma skoru — **tam (1) / kısmi (0.5) / kayıp (0)** + nitel not
- **Çıktı:** anlamsal kayıp **matrisi** (ısı haritası) + yön asimetrisi (A→B vs B→A) + tartışma (protokol model farkları)
- **Geçerlilik tehditleri:** köprü implementasyon/sürüm farkı, zaman/cache, örneklem
- **Tekrar üretilebilirlik:** ölçüm harness'i + korpus + ham veri yayımla
- 🗣️ *"Soru gelirse: katkıyı bilime çeviren adım bu — kontrollü gönderilerle köprü sonrası kaybı alan-alan ölçüp bir matris çıkarmak."*

### A7 — Teknoloji Seçim Gerekçeleri
- **Fastify:** yüksek throughput + esnek içerik-tipi (AP `activity+json` için şart)
- **Drizzle:** TypeScript-first, tip güvenli sorgu; **PostgreSQL:** FTS + karmaşık sorgu
- **BullMQ/Redis:** dayanıklı federasyon teslimi + zamanlanmış işler (moment expiry, import sweep)
- **Better Auth:** Lucia deprecated; daha aktif
- 🗣️ *"Soru gelirse: her seçim federasyonun gereksinimine bağlı — özellikle Fastify'ın içerik-tipi esnekliği ve kuyrukların teslim dayanıklılığı."*

---

# JÜRİ SORUSU KALKANI

| Soru | Cevap nerede |
|---|---|
| Mastodon/Bluesky'den farkın? | Slayt 3 + **A2** |
| Bridgy Fed zaten köprülüyor? | Slayt 6 + **A2** (native, tek sunucu, loop guard) |
| Federasyonu kendin mi yazdın? | Slayt 5 + **A5** |
| Ölçeklenir mi / performans? | Slayt 4 (kuyruk) + **A1** |
| Güvenlik / kötüye kullanım? | Slayt 8 + **A3** |
| Özgün/bilimsel katkı? | Slayt 10–11 + **A6** |
| Sınırların ne? | Slayt 11 (sen sormadan söyle) |
| Neden bu teknolojiler? | **A7** |
| Test / kaç kullanıcı? | Slayt 9 + "referans implementasyon, ölçek hedefi değil" |
| Moderasyon federe ağda? | Slayt 8 + **A6** |

**Altın kural:** Slayt 10 (katkılar) + 11 (kısıtlar) en kritik ikili — jürinin en sevdiği soruları sen sormadan cevaplarsan kontrol sende kalır.

---

# ANLATMA KAYGISI İÇİN 6 KURTARICI
1. Slayt başına tek mesaj — konuşma metnini **aynen oku**.
2. Demo senin yerine konuşur — 20–30 sn canlı gez, izleyici ekrana bakarken rahatla.
3. Kısa cümle kur, **dur**. Sessizlik kötü değil.
4. Bilmediğin soruda: *"İyi soru — şu an kapsam dışı bıraktım / Faz 2'de ölçmeyi planlıyorum."*
5. İlk 30 saniyeyi (kapak) ezberle; iyi başlangıç gerisini akıtır.
6. Demoyu önceden **ekran kaydına al** — canlı çökerse video oynat.

---

*Hazırlık: tek bir prova + bir ekran kaydı = savunmanın %80'i hazır.*
