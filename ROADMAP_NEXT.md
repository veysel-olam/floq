# floq — Roadmap (Sonraki Bölüm)

> **Lansman sonrası stratejik yol haritası.**
> Odak: eksileri artıya çevirmek + bitirme projesine ölçülebilir bilimsel değer kazandırmak.
> `ROADMAP.md` özellik inşasını (Phase 0–7, v1.x, v2.0) kapsar ve büyük ölçüde tamamlandı.
> Bu belge "ne inşa ettik" değil, **"bundan ne çıkar"** sorusunu yanıtlar.

*Başlangıç: Haziran 2026*

---

## Temel Pivot

> **"Tüketici sosyal ağı" → "Çok-protokollü federasyon referans implementasyonu + araştırma test ortamı"**

"Sosyal ağ" çerçevesinde eksiler ölümcüldür (ağ etkisi, bakım yükü, hukuki risk).
Aynı artefaktı **referans implementasyon ve araştırma platformu** olarak konumlandırınca
en büyük eksi (kullanıcı kazanma) **alakasız** hale gelir: referans implementasyonun
milyonlarca kullanıcıya değil, *doğru çalıştığının ve ölçülebildiğinin* kanıtına ihtiyacı vardır.

**Tek cümlelik konumlandırma:**
*"floq; ActivityPub federasyonunu, Bluesky/Nostr köprülerini ve modern bir tüketici
deneyimini tek self-hostable sunucuda birleştiren, çok-protokollü birlikte-çalışabilirliğin
ölçülebilir bir referans implementasyonudur."*

---

## Eksi → Artı Haritası (özet)

| Eksi (mevcut durum) | Çevirme stratejisi | Artı (hedef) | Faz |
|---|---|---|---|
| Ağ etkisi yok, boş ağ | Federasyon + köprülerle 1. günden milyonlarla etkileşim | "Ada değil" — niş + erişim | 1 |
| Protokol kimsenin umurunda değil | Interop'u **ölç** (anlamsal kayıp çalışması) | Yayınlanabilir bilimsel katkı | 2 |
| Hukuki/moderasyon yükü | Trust & Safety çerçevesine dönüştür | Özgün, savunulabilir etik açı | 3 |
| Tek kişilik kırılgan dev sistem | Tehdit modeli + test + olay günlüğü | Mühendislik titizliği kanıtı | 4 |
| Sistem var ama bilimsel soru yok | Soru + ölçüm + karşılaştırma ekle | Savunulabilir tez + yayın | 5 |

---

## Faz 0 — Konumlandırma & Kapsam Dondurma
*≈3 gün · Eksi → Artı: "dağınık scope" → "savunulabilir katkı"*

- [ ] Tek paragraflık konumlandırma cümlesini README + landing'e işle
- [ ] **Scope freeze**: yeni tüketici özelliği eklemeyi durdur (mevcut set dondurulur)
- [ ] Bu belgeyi tek "kuzey yıldızı" olarak ilan et; sonraki tüm iş buraya bağlanır
- [ ] Tez/savunma iskeletini taslak hâlinde çıkar (bölüm başlıkları = Faz 2–5 çıktıları)

**Başarı ölçütü:** Bir cümlede "floq nedir + neden önemli" yanıtı net.

---

## Faz 1 — Ada Olmamak (adopsiyon eksisi)
*≈1–2 hafta · Eksi → Artı: "boş ağ" → "federasyonla 1. günden erişim"*

- [ ] Onboarding kullanıcıyı anında fediverse + Bluesky + Nostr'a bağlasın (rehberli)
- [ ] Köprü güvenilirliği: outbound + inbound uçtan uca tekrar doğrula (Mastodon, Bluesky, Nostr)
- [ ] Dar bir niş seç ve oraya odaklan (örn. Türkçe fediverse / üniversite bölümü)
- [ ] "Keşfet"te federe içerik öne çıksın — yeni kullanıcı boş feed görmesin
- [ ] 10–30 kişilik *bilinçli/gönüllü* çekirdek kullanıcı (research instance ToS ile)

**Başarı ölçütü:** Yeni kullanıcı **<5 dk** içinde üç ağdan birinde birini takip edip etkileşebiliyor.

---

## Faz 2 — Interop Araştırması ← **TEZİN KALBİ**
*≈3–4 hafta · Eksi → Artı: "protokol umursanmaz" → "ölçülmüş bilimsel katkı"*

**Araştırma sorusu:** *AP ↔ AT Protocol ↔ Nostr arasında köprüleme sırasında hangi
anlamsal bilgi ne ölçüde korunur/kaybolur?*

- [ ] Ölçüm boyutlarını tanımla: kimlik, görünürlük (visibility), quote/alıntı,
      reaksiyon/beğeni, medya, thread/yanıt, moderasyon sinyalleri, zaman damgası
- [ ] Test korpusu: her boyut için kontrollü gönderiler üret, üç ağa da gönder/al
- [ ] Ölçüm harness'i (otomatik): köprü sonrası alınan nesneyi orijinalle karşılaştır
- [ ] **Anlamsal kayıp matrisi** üret (boyut × protokol-çifti → korunma oranı/notu)
- [ ] Bulguları yorumla: nerede, neden kayıp; protokol model farkları

**Başarı ölçütü:** Tabloya dökülmüş, tekrar üretilebilir bir "interop kayıp matrisi" + tartışma.
**Çıktı:** Tez bölümü + potansiyel kısa makale/atölye bildirisi.

---

## Faz 3 — Protokoller Arası Güven & Güvenlik (T&S)
*≈2 hafta · Eksi → Artı: "hukuki yük" → "özgün trust & safety çerçevesi"*

- [ ] Moderasyon sinyallerinin köprü üstünden yayılımını haritalandır
      (engelleme, rapor, yaş-koruma, sensitive/CW) — nerede korunur, nerede kopar?
- [ ] Mevcut parçaları formelleştir: block federasyonu, `bsky_uri` loop guard, çocuk koruma, CSAM kategorisi
- [ ] Köprülerde **döngü/kötüye-kullanım** dinamiğini model olarak yaz (loop guard genellemesi)
- [ ] Bridgy Fed + native köprü birlikte kullanımında çift-yol riskini belgele + azalt
- [ ] Research instance için açık ToS + moderasyon politikası + şeffaflık raporu

**Başarı ölçütü:** "Moderasyonun federe + köprülü ağda yayılımı" için bir çerçeve + boşluk analizi.
**Çıktı:** Tez bölümü (etik/güvenlik) — jüri için güçlü, savunulabilir açı.

---

## Faz 4 — Güvenilirlik & Sağlamlaştırma (bakım/güvenlik eksisi)
*≈1–2 hafta · Eksi → Artı: "kırılgan dev sistem" → "test edilmiş, modellenmiş sistem"*

- [ ] **Tehdit modeli** belgesi (federasyon saldırı yüzeyi: spoofing, replay, DoS, veri bozma)
- [ ] Federasyon **entegrasyon test paketi** (follow/post/like/boost/DM/block senaryoları)
- [ ] **Olay günlüğü (incident log)** — gerçek vakaları vaka çalışmasına çevir:
      local-actor overwrite açığı, content-type 415, fail2ban, migration'sız deploy 500'leri
- [ ] Abuse/rate-limit sertleştirme + gözlemlenebilirlik (deliverability, dead-letter)

**Başarı ölçütü:** Tehdit modeli + yeşil test paketi + dürüst olay günlüğü.
**Çıktı:** Tez bölümü (sistem mühendisliği/güvenlik) — derinlik kanıtı.

---

## Faz 5 — Değerlendirme & Yazım (bilimsel değeri kilitle)
*≈2 hafta · Eksi → Artı: "soru yok" → "soru + ölçüm + karşılaştırma = bilim"*

- [ ] **Karşılaştırma tablosu:** floq vs Mastodon vs Bluesky vs Hubzilla/streams
      (protokol sayısı, köprü, kimlik modeli, moderasyon yayılımı, UX, self-host)
- [ ] Küçük **kullanılabilirlik çalışması** (5–10 kişi): çok-protokollü karmaşıklık kullanıcıdan gizlenebildi mi?
- [ ] Kısıtlar (limitations) bölümü — dürüst sınırlar (ölçek, niş, tek-kişi)
- [ ] Gelecek iş (future work) — video köprü, yanıt thread eşleme, etkileşim geri akışı
- [ ] Tez/savunma sunumu + reproducibility paketi (harness + veri)

**Başarı ölçütü:** Soru → yöntem → ölçüm → karşılaştırma → tartışma zinciri tam.

---

## Olası Bilimsel Çıktılar

1. **Interop anlamsal kayıp matrisi** (Faz 2) — en yüksek yayın potansiyeli
2. **Federe + köprülü ağda moderasyon yayılımı** çerçevesi (Faz 3)
3. **Çok-protokollü federasyonun güvenlik vaka çalışması** (Faz 4)
4. **Merkeziyetsizliğin kullanılabilirliği** — UX çalışması (Faz 5)

---

## Bilinçli Kapsam Dışı (Bu Bölümde)

- Kitlesel kullanıcı büyümesi / pazarlama (referans implementasyon için gereksiz)
- Yeni tüketici özelliği (scope donduruldu)
- Ticarileştirme / abonelik / reklam
- Video köprü, yanıt import, etkileşim geri akışı → "gelecek iş"

---

## Öncelik Sırası

```
Faz 0 (konumlandırma)
   ↓
Faz 1 (ada olmama) ───→ en somut/hızlı kazanım
   ↓
Faz 2 (interop ölçümü) ─→ en yüksek bilimsel getiri ← tezin kalbi
   ↓
Faz 3 (T&S) → Faz 4 (sağlamlaştırma) → Faz 5 (yazım)
```

*Süreler bitirme takvimine göre ayarlanabilir. Faz 2 ve 3 paralel ilerleyebilir.*

*Son güncelleme: Haziran 2026*
