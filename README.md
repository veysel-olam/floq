# floq

Merkeziyetsiz, federe sosyal ağ. ActivityPub (Mastodon uyumlu) + AT Protocol köprüsü.

> "Flow together, own your data."

---

## Özellikler

- Gönderiler, yanıtlar, boost, beğeni, yer imi
- E2E şifreli doğrudan mesajlaşma (X25519)
- Akış algoritması — kronolojik, trending veya kendi kuralların
- Flows (konu kanalları), Moments (24 saatlik), Spaces (sesli/yazılı odalar)
- ActivityPub federasyonu — Mastodon, Pixelfed ve diğer fediverse instance'larıyla uyumlu
- Mastodon API uyumu — Ivory, Tusky, Elk gibi istemciler çalışır
- AT Protocol / Bluesky köprüsü (XRPC, Feed Generator)
- Passkey, 2FA, WebAuthn
- PWA — mobil kurulum desteği
- Admin paneli, moderasyon, raporlama

---

## Geliştirme Ortamı

### Gereksinimler

- Node.js 22+
- pnpm 10+
- Docker & Docker Compose

### Kurulum

```bash
git clone https://github.com/your-org/floq.com
cd floq.com
pnpm install
```

### Servisler (PostgreSQL + Redis + MinIO)

```bash
docker compose up -d
```

### Environment Variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**`apps/api/.env` için zorunlu değişkenler:**

```env
DATABASE_URL=postgresql://floq:floq@localhost:5432/floq
REDIS_URL=redis://localhost:6379
APP_DOMAIN=localhost:3001
APP_URL=http://localhost:3001
WEB_URL=http://localhost:3000

# 64 karakter hex — üretmek için:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=

# En az 32 karakter rastgele string
BETTER_AUTH_SECRET=

# MinIO (docker-compose ile otomatik çalışır)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=floq-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_PUBLIC_URL=http://localhost:9000/floq-media
```

**`apps/web/.env` için zorunlu değişkenler:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Veritabanı

```bash
# İlk kurulumda schema'yı uygula
docker exec floq-postgres psql -U floq -d floq -f /dev/stdin < apps/api/src/db/schema.sql
```

Veya Drizzle ile:

```bash
cd apps/api && npx drizzle-kit push
```

### Geliştirme Sunucusu

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- MinIO Console: http://localhost:9001 (minioadmin / minioadmin)

---

## Production Deployment

Docker image'ları GitHub Container Registry üzerinden dağıtılır.

### Gerekli GitHub Secrets

| Secret | Açıklama |
|--------|----------|
| `DEPLOY_HOST` | Production sunucu IP |
| `DEPLOY_USER` | SSH kullanıcısı |
| `DEPLOY_KEY` | SSH private key |
| `NEXT_PUBLIC_API_URL` | Production API URL |
| `NEXT_PUBLIC_APP_URL` | Production web URL |
| `E2E_ENCRYPTION_KEY` | E2E testler için encryption key (64 hex char) |
| `E2E_AUTH_SECRET` | E2E testler için auth secret |
| `E2E_EMAIL` | E2E test kullanıcısı email |
| `E2E_PASSWORD` | E2E test kullanıcısı şifre |

### Domain & DNS

Caddy iki domaini yönetir (otomatik Let's Encrypt TLS):

| Kayıt | Tip | Değer |
|---|---|---|
| `flq.social` | A | `<sunucu_IP>` → web |
| `api.flq.social` | A | `<sunucu_IP>` → api |
| `www.flq.social` | CNAME | `flq.social` (opsiyonel) |

Medya prod'da harici S3/Cloudflare R2'de tutulur (`S3_PUBLIC_URL`); medya subdomaini sunucuda değil R2 tarafında ayarlanır.

### Sunucuda (ilk kurulum)

```bash
mkdir -p /opt/floq && cd /opt/floq
# docker-compose.prod.yml ve Caddyfile'ı buraya kopyala

# Ortam değişkenleri — dosya adı MUTLAKA .env olmalı (aşağıdaki uyarı)
cp .env.prod.example .env && nano .env   # ACME_EMAIL, şifreler, S3, KLIPY_API_KEY...

# Başlat — Caddy DNS doğruysa TLS sertifikalarını otomatik alır
docker compose -f docker-compose.prod.yml up -d
```

> ⚠️ **Env dosya adı:** Deploy `docker compose ... up`'ı `--env-file` olmadan çalıştırır,
> yani Compose varsayılan **`.env`** dosyasını okur. Sunucuda dosyayı `.env.prod`
> olarak bırakırsan değişkenler container'a geçmez — `.env` olarak kaydet.

### İlk DB kurulumu

`migrate()` baz şemayı kurar; sonraki şema değişiklikleri `drizzle-kit push` / direkt SQL
ile yönetilir. Örn. composer taslak senkronu tablosu:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U floq -d floq -c "CREATE TABLE IF NOT EXISTS composer_drafts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE, content text NOT NULL DEFAULT '', content_warning varchar(500), updated_at timestamp NOT NULL DEFAULT now()); CREATE UNIQUE INDEX IF NOT EXISTS composer_drafts_actor_unique ON composer_drafts(actor_id);"
```

### Sonraki deploy'lar

`main`'e push → GitHub Actions image build + SSH ile `docker compose pull && up -d`.
Sunucuya elle dokunmaya gerek yok (env değişikliği hariç).

---

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | Fastify, TypeScript, Drizzle ORM |
| Veritabanı | PostgreSQL 17 |
| Cache/Queue | Redis 7 + BullMQ |
| Auth | Better Auth |
| Dosya | MinIO (local) / Cloudflare R2 (prod) |
| Federation | ActivityPub (ActivityStreams 2.0) |
| Monorepo | Turborepo + pnpm workspaces |

---

## Lisans

MIT
