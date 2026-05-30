# Veritabanı Şema Yönetimi (runbook)

floq prod şeması **`drizzle-kit push`** ile yönetilir — `drizzle-kit migrate` ile **değil**.

## Neden push, neden migrate değil?

Migration journal (`meta/_journal.json`) **0013'te donmuş**. Bu klasördeki `0014_*`–`0030_*`
SQL dosyaları journal'a **kayıtlı değil** (tarihsel/öksüz). Dolayısıyla `drizzle-kit migrate`
yalnızca 0000–0013'ü uygular ve eksik kolonlarla 500'lere yol açar. **`migrate` çalıştırma.**

Şemanın tek doğru kaynağı: **`src/db/schema.ts`**. `drizzle-kit push` onu doğrudan DB'ye
senkronlar.

## push'un kapsamadığı şeyler → `extras.sql`

push yalnızca schema.ts'te ifade edilebilen şeyleri yansıtır. **Generated (hesaplanan)
kolonlar** ve **GIN tam-metin indeksleri** schema.ts'te yok — onlar yalnızca
[`extras.sql`](./extras.sql)'de yaşar (tam-metin arama kolonları: `posts.content_search`,
`actors.search_vector`). Bu olmadan `/api/search` 500 verir (`column "search_vector" does not exist`).

`extras.sql`'deki her ifade idempotenttir (`IF NOT EXISTS`) — kaç kez çalıştırılırsa çalıştırılsın güvenli.

## Yaygın işlemler

### Şema değişikliği (yeni tablo/kolon)
```bash
# schema.ts'i düzenle, sonra:
pnpm --filter @floq/api db:push
```

### Taze DB / sıfırlama sonrası (KRİTİK)
`DROP SCHEMA public CASCADE` veya yeni bir DB sonrası **ikisini birden** çalıştır:
```bash
pnpm --filter @floq/api db:setup     # = db:push + db:extras
```
`db:extras`'i unutursan arama çalışmaz.

### Prod'da (Docker)
```bash
# push'u docker ağı içinden bir node container'ıyla çalıştır (memory: project-deployment)
# extras.sql'i postgres container'ına uygula:
cd /opt/floq && docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U floq -d floq < apps/api/drizzle/extras.sql
```

## FTS değiştirmek istersen
`extras.sql`'deki `to_tsvector(...)` ifadesini düzenle, sonra prod'da kolonu düşürüp
yeniden ekle (generated kolon ifadesi `ALTER ... ADD COLUMN IF NOT EXISTS` ile değişmez):
```sql
ALTER TABLE posts DROP COLUMN IF EXISTS content_search;
-- sonra extras.sql'i tekrar çalıştır
```
