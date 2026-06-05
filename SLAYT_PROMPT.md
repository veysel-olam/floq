# floq — Slayt Üretim Prompt'u (Gamma / Manus / Tome)

**Nasıl kullanılır:**
1. Aşağıdaki `── KOPYALA ──` çizgileri arasındaki **her şeyi** seç-kopyala.
2. Gamma → "Paste in text" / "Generate"; Manus → "bu içerikten sunum üret"; Tome → "Create".
3. Araç içeriği bozarsa, aynı metin zaten son slayt yazın olarak elinde — manuel doldur.
4. Daha uzun, aynen-okunur konuşma metinleri `SUNUM.md`'de.

---

────────────────────────── KOPYALA ──────────────────────────

ROL: Profesyonel sunum tasarımcısısın.
GÖREV: Aşağıdaki "İÇERİK"ten, bilgisayar mühendisliği BİTİRME SAVUNMASI için bir sunum
(deck) tasarla. İzleyici: teknik jüri. Süre: 20 dakika + canlı demo. Dil: Türkçe.
ÇIKTI: 12 ana slayt + 4 yedek slayt (toplam 16 kart).

TASARIM KURALLARI:
- Slayt başına TEK ana mesaj; en fazla 4 kısa madde; bol beyaz alan; paragraf değil madde.
- Vurgu rengi sıcak mercan #E8593C; geometrik sans-serif başlık; koyu+açık temaya uyumlu.
- Her slayta uygun diagram/ikon öner (özellikle slayt 2, 4, 5, 6).
- Üstte küçük adım etiketi göster: Problem → Çözüm → Nasıl → Kanıt → Titizlik → Katkı.
- Slayt 7 "Demo" görselsiz, büyük tek başlık olsun.
- A2'yi GERÇEK bir tablo olarak render et.
- Yeni teknik iddia UYDURMA; içeriği aynen kullan. Her slaytın presenter-notes alanına 🗣️ notunu koy.

═══════════════ İÇERİK ═══════════════

SLAYT 1 — Kapak  [Açılış]
• floq — Çok-protokollü, federe sosyal ağ
• [Ad] · [Bölüm] · Danışman: [Ad] · 2026
🗣️ Merhaba, ben [ad]. Projem floq: kendi sunucunda çalışan, üç sosyal ağ protokolünü birbirine bağlayan bir sosyal ağ. Hem anlatacağım hem canlı göstereceğim.

SLAYT 2 — Problem  [Problem]
• Merkezi platformlar: veri sende değil, algoritma kapalı, platforma kilitlisin
• Merkeziyetsiz alternatifler birbirini görmüyor — Mastodon, Bluesky, Nostr ayrı adalar
• Görsel: birbirine bakmayan 3 ada
🗣️ İki kötü seçenek var: ya merkezi platformlara mahkûmuz, ya da özgür alternatifler birbiriyle konuşamıyor. floq bu boşluğa giriyor.

SLAYT 3 — Çözüm: floq  [Çözüm]
• Üç protokolü tek sunucuda köprüler: ActivityPub + AT Protocol (Bluesky) + Nostr
• Modern arayüz + kendi-barındırılabilir (self-hostable)
• Ne değil: sıradan bir Mastodon klonu değil — bir köprü + ağ
🗣️ floq bu üç adayı tek köprüde birleştiriyor; floq'taki kullanıcı Mastodon'daki ve Bluesky'deki birini aynı yerden takip edebiliyor.

SLAYT 4 — Sistem Mimarisi  [Nasıl]
• Web: Next.js · API: Fastify · Veritabanı: PostgreSQL
• Kuyruk/önbellek: Redis + BullMQ · Paketleme: Docker
• Görsel: üst düzey kutu diyagramı
🗣️ Federasyon mesajları doğrudan değil, arka planda kuyrukla teslim ediliyor; böylece sistem yük altında ayakta kalıyor, mesaj kaybolmuyor.

SLAYT 5 — Federasyon Nasıl Çalışır  [Nasıl]
• WebFinger (keşif) → HTTP Signatures (kimlik) → inbox/outbox (teslim)
• Kütüphane değil — protokolü sıfırdan implemente ettim
🗣️ Uzak kullanıcıyı buluyoruz, her isteği imzayla doğruluyoruz, gönderiyi karşı sunucuya teslim ediyoruz. floq gerçekten Mastodon ağıyla konuşuyor.

SLAYT 6 — Köprüler + Döngü Koruması  [Nasıl — özgünlük]
• Bluesky çift yönlü: floq→Bluesky paylaş + Bluesky→floq içe aktar
• Nostr köprüsü
• En zor problem: loop guard — içerik köprüde sonsuza dek dönmesin
🗣️ Projenin en özgün kısmı. Asıl zorluk döngüyü engellemekti; her gönderiye kimlik işaretleyip kendi çıktımı tanıyan bir koruma yazdım.

SLAYT 7 — CANLI DEMO  [Kanıt]
• Demo · flq.social
🗣️ Bu bir maket değil, gerçekten canlı. İzninizle birkaç dakika gezdireyim. (Rota: gönderi at → federe gönderi → Köprüler durum → Moment + müzik.)

SLAYT 8 — Güven & Güvenlik  [Titizlik]
• Çocuk koruma (13+, kısıtlı mod) · CSAM rapor kategorisi
• Aylık şeffaflık raporu · blok/rapor federasyonu
🗣️ Sosyal ağ işletmek sorumluluk demek; yaş koruması, raporlama ve şeffaflığı baştan kurdum, sinyaller federe ağa da iletiliyor.

SLAYT 9 — Mühendislik Dersleri  [Titizlik]
• Yakalanıp kapatılan güvenlik açığı (kimlik üzerine yazma)
• Şema değişiminde migration disiplini · canlı federasyon hata ayıklama
🗣️ Gerçek sorunlarla karşılaştım: bir güvenlik açığını fark edip kapattım, dağıtım disiplinini sahada öğrendim. En öğretici kısım buydu.

SLAYT 10 — Katkılar  [Katkı — en kritik]
• Üç protokolü native köprüleyen referans implementasyon
• Çift yönlü Bluesky köprüsü + loop guard
• Federe trust & safety
• Çalışan, dağıtılmış sistem
🗣️ Dört somut katkı; tek bir mainstream ağ bu üç protokolü bir arada sunmuyor — fark burada.

SLAYT 11 — Kısıtlar & Gelecek  [Katkı — olgunluk]
• Dürüst sınır: kitlesel ölçek hedeflenmedi, niş + tek geliştirici
• Bilimsel sonraki adım: protokoller-arası anlamsal kayıp ölçümü
• Gelecek: video köprü, yanıt aktarımı, etkileşim geri akışı
🗣️ Sınırlarımı açıkça söylüyorum: bu bir referans implementasyon. Asıl bilimsel adım, köprülemede hangi bilginin kaybolduğunu ölçmek.

SLAYT 12 — Kapanış  [Kapanış]
• "Flow together, own your data."
• flq.social · Teşekkürler
🗣️ floq, merkeziyetsiz ağların dağınıklığına tek-sunucu bir köprü öneriyor — hem çalışan sistem hem ölçülebilir araştırma sorusu. Teşekkürler, sorularınızı alabilirim.

─────────── YEDEK SLAYTLAR (sonda ayrı bölüm) ───────────

A1 — Detaylı Mimari
• Caddy (TLS + yönlendirme) → web (Next.js) / api (Fastify)
• PostgreSQL · Redis (BullMQ: federation, crosspost, moment-expiry) · MinIO (medya)
• Docker Compose · GitHub Actions CI/CD (Hetzner)

A2 — Karşılaştırma Tablosu  (GERÇEK TABLO olarak render et)
Sütunlar: Özellik | floq | Mastodon | Bluesky | Bridgy Fed | Hubzilla
Satırlar:
- Protokol sayısı: 3 (AP+ATProto+Nostr) | 1 (AP) | 1 (ATProto) | köprü servisi | çok (Zot+AP)
- Köprü: native/gömülü | yok | yok | harici servis | kısmi
- Kimlik: yerel+DID:web+Nostr | @user@instance | DID+PDS | — | nomadic
- Moderasyon: yerel+federe+çocuk koruma | yerel+federe | merkezî+labeler | yok | yerel
- Self-host: evet | evet | zor | hayır | evet
- Tüketici UX: evet | sınırlı | sınırlı | yok | eski
🗣️ Tek satırda üç protokol + native köprü + modern UX'i birleştiren başka satır yok.

A3 — Güvenlik Açığı Vakası
• Neydi: uzak-aktör tazeleme, yerel aktörü ezebiliyordu → kimlik bozulması
• Çözüm: yerel aktör koruması (isLocal guard) + sahte-yerel aktör reddi
• Sınıf: kimlik-doğrulamasız DoS (veri çalma değil)

A6 — Bilimsel Deney Tasarımı (interop anlamsal kayıp)
• Soru: AP ↔ ATProto ↔ Nostr köprülenirken hangi bilgi ne kadar korunur?
• Boyutlar: kimlik, görünürlük, metin, hashtag, mention, quote, medya+alt, reaksiyon, yanıt/thread, zaman, moderasyon sinyali
• Yöntem: kanonik test gönderileri → üç hedefe gönder/al → alan-alan otomatik karşılaştır
• Metrik: korunma skoru (tam/kısmi/kayıp) → anlamsal kayıp matrisi + yön asimetrisi
• Çıktı: ısı haritası + tartışma; harness + korpus + ham veri yayımla

────────────────────────── KOPYALA SONU ──────────────────────────

---

## Araç-özel ipuçları

- **Gamma:** "Paste in text" modunu seç (Generate değil) → araç her `SLAYT N` bloğunu bir karta çevirir; "Condense / Preserve" sorusunda **Preserve** seç (metni bozmasın). Tema: koyu + tek vurgu rengi.
- **Manus.ai:** "Bu içerikten 16 slaytlık bir sunum üret, başlıkları ve maddeleri aynen kullan, her slayta presenter note ekle, A2'yi tablo yap." şeklinde ek talimatla ver.
- **Tome / Plus AI:** outline modunda her `SLAYT N`'i bir bölüm başlığı olarak gir.
- Görseller isabetsiz gelirse: slayt 2 "3 kopuk ada", slayt 5 "akış oku diyagramı", slayt 6 "floq merkezde üç ağa bağlı yıldız" diye elle yönlendir.
