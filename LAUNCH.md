# floq — Lansman Stratejisi

> Teknik roadmap: `ROADMAP.md`
> Bu belge: kim, nasıl, ne zaman gelecek.

---

## Vizyon & Konum

**floq ne değil:** niş platform (W Social gibi siyasetçi ağı), teknik kitle için araç (Mastodon), ideoloji projesi.

**floq ne:** özgürlük temelli, genel amaçlı sosyal ağ. Kullanıcı verisine sahip çıkar, algoritmayı şeffaf tutar, platform bağımlılığı yaratmaz. Herkes için — ama önce bir toplulukla başlar.

**İlk soru:** Twitter gibi yaygınlaşmak istiyorsan ilk 10.000 kişi kim?
Twitter sırası: teknoloji camiası → gazeteciler → siyasetçiler → genel kitle.
floq sırası: üniversite çevresi → genişleme.

---

## Boş Platform Problemi

Sosyal ağların çoğu bu yüzden ölür:

1. İlk kullanıcı uygulamayı açar
2. Takip edecek kimse yok, feed boş
3. Kapatır, bir daha açmaz

**Çözüm: platforma kimse gelmeden önce zemin hazırla.**

---

## Faz 0 — Launch Öncesi Hazırlık
*Teknik değil, içerik ve onboarding.*

### İçerik zemini
- [ ] Kendi hesabınla düzenli gönderi paylaş — platform "canlı" görünsün
- [ ] Floq resmi hesabı oluştur (`@floq`) — duyurular, karşılama mesajları, platform haberleri
- [ ] İlk 10–15 gönderi hazır olsun: platform tanıtımı, felsefesi, özellik ipuçları

### Onboarding iyileştirmesi
- [ ] "Önerilen hesaplar" ekranını doldur — şu an büyük ihtimalle boş geliyor
  - Minimum: kendi hesabın + floq resmi hesabı + 3–5 aktif kullanıcı
  - Yeni gelen birinin feed'i ilk açışta boş olmamalı
- [ ] Kayıt sonrası ilk feed'de en az 5–10 gönderi görünmeli

### Teknik kontrol
- [ ] Production sunucu canlı
- [ ] Kayıt akışı sorunsuz (email doğrulama dahil)
- [ ] Mobile deneyim test edildi (üniversite öğrencileri telefonda girecek)
- [ ] Hata raporlama aktif (Sentry)

---

## Faz 1 — Üniversite Lansmanı
*Bitirme projesi kapsamında, tanıdık çevre.*

### Neden üniversite çevresi iyi bir başlangıç?
- Seni tanıyorlar → güven var, denemek için düşük eşik
- Geri bildirim verirler → hangi özellikler işe yarıyor, hangisi karmaşık
- Sosyal bağ zaten var → aralarında birbirini takip ederler → feed canlanır
- Türkçe platform → doğru kitle

### Davet süreci
- [ ] İlk tur: 50–100 kişi, elle davet (link veya davet kodu)
- [ ] Onları karşıla — ilk gün bir karşılama gönderisi paylaş, @mention at
- [ ] Platform kurallarını ve felsefesini basit bir gönderiyle anlat
- [ ] Sorunları hızlı çöz — ilk kullanıcı deneyimi kritik

### Gözlemle
- Kimler aktif kalıyor, kimler bir daha girmiyor?
- En çok hangi özelliği kullanıyorlar?
- Ne zaman bırakıyorlar? (onboarding mı, feed mi, başka bir şey mi?)
- Sana ne soruyor, ne şikâyet ediyorlar?

**Bu fazda yeni özellik ekleme. Kırılanı düzelt, kullanıcıları dinle.**

---

## Faz 2 — Ölçüm & Reklam Denemesi
*Üniversite çevresi yerleştikten sonra.*

### Amaç
Organik ilgi var mı, yoksa yok mu — bunu anlamak.
Mezuniyet savunması için somut rakamlar elde etmek.

### Ne yapılacak
- [ ] Basit hedefli reklam (Instagram veya Twitter — ironi kabul)
  - Hedef kitle: 18–28 yaş, Türkiye, teknoloji/üniversite ilgili
  - Mesaj: "Verinin senin, algoritman şeffaf" — bu kitleye dokunur
  - Bütçe küçük tutulsun — amaç istatistik, büyük büyüme değil
- [ ] Reklam öncesi landing page (floq.com) güçlü olmalı
  - Neden farklı? Ne vaat ediyor? Nasıl kaydolunur?
- [ ] Ölçülecekler: kayıt sayısı, 7 günlük retention, en çok kullanılan özellik

### Dürüst beklenti
Reklamla gelen kullanıcılar üniversite çevresi kadar bağlı olmaz.
Asıl değer: platform yabancı birine de anlamlı geliyor mu — bunu test etmek.

---

## Faz 3 — Faz B'ye Köprü
*Gerçek kullanıcı verisi geldikten sonra.*

Buradan sonrası `ROADMAP.md` Faz B ile devam eder:
hangi niş büyüyor, hangi özellik isteniyor, büyüme nasıl sürdürülür — bunları kullanıcılar söyler.

Şu an tahmin etmenin anlamı yok.

---

## Özet Sıra

```
Faz 0 — Zemin hazırla (içerik + onboarding)
    ↓
Faz 1 — Üniversite lansmanı (50–100 kişi, elle davet)
    ↓
       Dinle, kırılanı düzelt, yeni özellik ekleme
    ↓
Faz 2 — Reklam denemesi (küçük bütçe, ölçüm amaçlı)
    ↓
Faz 3 — Faz B (kullanıcı verisiyle şekillenecek)
```

---

*Son güncelleme: Mayıs 2026*
