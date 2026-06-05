# Protokoller-Arası Anlamsal Kayıp Ölçümü

> floq'un çok-protokollü köprüsünün araştırma katmanı (ROADMAP_NEXT.md → Faz 2).
> Tezin kalbi: *bir gönderi bir protokolden diğerine köprülenirken hangi anlamsal
> bilgi ne ölçüde korunur?*

## Araştırma Sorusu (RQ)

> **RQ:** ActivityPub (AP) ↔ AT Protocol (Bluesky) ↔ Nostr arasında bir gönderi
> köprülenirken, gönderinin anlamsal boyutları (görünürlük, alıntı, medya, yanıt
> bağlamı, içerik uyarısı vb.) hangi yönde ne ölçüde korunur veya kaybolur?

İkincil sorular:
- **RQ1 (asimetri):** Kayıp yönlüdür: A→B ile B→A aynı mı? (protokol model farkları)
- **RQ2 (darboğaz):** Hangi boyut en kırılgan? Hangi protokol çifti en lossy?

## Yöntem — İki Katman

Ölçümü iki bağımsız katmanda yapıyoruz; biri *neden*i (kod), diğeri *gerçeği* (ağ) verir.

### Katman 1 — Statik Eşleme Denetimi (kod analizi)
floq, üç hedefe çıkışta üç ayrı **builder** kullanır:
- **AP:** `apps/api/src/lib/activityPub.ts → buildNote()`
- **Bluesky:** `apps/api/src/lib/bluesky.ts → crosspostToBluesky()`
- **Nostr:** `apps/api/src/lib/nostr.ts → crosspostToNostr()`

Her boyut için bu builder'ın o alanı hedef protokole **taşıyıp taşımadığını** kod
seviyesinde denetliyoruz. Hesap/ağ gerektirmez, tam tekrar üretilebilir, ve kaybın
*kök nedenini* (hangi satırda düştü) gösterir. `audit.ts` bu denetimi kodlar ve
matrisi üretir.

### Katman 2 — Ampirik Round-Trip (ağ doğrulaması)
Katman 1'in iddialarını gerçek ağlarda doğrular: kanonik test gönderilerini
(`corpus.ts`) floq'tan üç hedefe gönder, sonra hedeften **geri çek**, orijinalle
alan-alan karşılaştır. `harness.ts` bunun iskeletidir (hesap/anahtar gerektirir).
Katman 2, Katman 1'i ya doğrular ya da rafine eder (örn. Mastodon, metindeki `@`'dan
mention'ı *çıkarsayabilir* — statik denetimde "yok" olan bir şey ampirikte "kısmi"
olabilir).

## Boyutlar (Dimensions)

`dimensions.ts` içinde tanımlı. Bir gönderinin anlamsal birimleri:

| Kod | Boyut | Ne ölçülür |
|---|---|---|
| `identity` | Kimlik | Yazarın aynı/bağlı kimlikle temsili |
| `text` | Metin/biçim | Gövde metni + biçimlendirme korunması |
| `visibility` | Görünürlük | public/unlisted/followers/direct semantiği |
| `content_warning` | İçerik uyarısı | CW/sensitive bayrağı + özet |
| `hashtags` | Etiketler | Makine-okunur hashtag |
| `mentions` | Bahsetmeler | Makine-okunur @mention |
| `quote` | Alıntı | Alıntılı paylaşım bağlantısı |
| `media` | Medya | Görsel ek(ler)i |
| `media_alt` | Alt-metin | Erişilebilirlik alt-metni |
| `reply_thread` | Yanıt/iplik | Yanıt bağlamı / thread |
| `timestamp` | Zaman | Orijinal oluşturma zamanı |
| `language` | Dil | Dil etiketi |

> Beğeni/reaksiyon gibi *post-sonrası* etkileşimler ayrı aktivitelerdir; bu çalışma
> **gönderi nesnesinin** köprülenmesine odaklanır (kapsam dışı satırlar `n/a`).

## Skorlama Rubriği

Her `(boyut × hedef)` için:

| Skor | Anlam |
|---|---|
| `1` | **Tam** — boyut hedef protokolde makine-okunur biçimde korunur |
| `0.5` | **Kısmi** — bilgi var ama lossy/dejenere (ör. metne gömülü, kırpılmış, türetilmiş) |
| `0` | **Kayıp** — boyut hedefe hiç taşınmaz |
| `n/a` | Kapsam dışı / boyut bu hedefte anlamsız |

Her hücre bir **kod alıntısı** (`file:fn`) + **gerekçe** ile desteklenir → öznel değil.

## Çıktılar

- `MATRIX.md` — anlamsal kayıp matrisi (boyut × hedef) + gerekçeler (üretilen)
- `matrix.csv` — aynı veri, analiz/ısı-haritası için (üretilen)
- Tartışma: yön asimetrisi, darboğaz boyutlar, protokol model farkları

## Çalıştırma

```bash
# Katman 1 (statik denetim) — matrisi üretir, hesap gerektirmez:
npx tsx research/interop/audit.ts

# Katman 2 (ampirik) — .env'de hedef hesap/anahtarları gerektirir:
npx tsx research/interop/harness.ts   # iskelet
```

## Geçerlilik Tehditleri

- **Köprü implementasyon farkı:** Sonuçlar *floq'un* builder'larını ölçer, "AP genel olarak" değil. Başka bir sunucu farklı eşleyebilir.
- **Hedef çıkarımı:** Statik "kayıp", ampirikte hedefin türetmesiyle "kısmi"ye dönebilir (mention örneği).
- **Sürüm/zaman:** Bluesky/Nostr/Mastodon davranışı sürümle değişir; ölçüm tarihlenmeli.
- **Örneklem:** Korpus boyut başına temsilî birkaç vaka; uç durumlar ayrı.

## Tekrar Üretilebilirlik

Matris koddan üretilir (`audit.ts`); korpus ve harness sürümlenir. Ampirik ham
veri (gönderilen/alınan nesneler) `research/interop/data/` altında saklanmalı
(henüz boş). Her koşu tarih + commit hash ile etiketlenir.
