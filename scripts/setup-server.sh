#!/bin/bash
# Floq — Production sunucu ilk kurulum scripti
# Hedef: Ubuntu 24.04 LTS (Hetzner CX22 veya DigitalOcean Droplet)
# Kullanım: curl -fsSL https://raw.githubusercontent.com/KULLANICI/floq.com/main/scripts/setup-server.sh | bash
set -euo pipefail

FLOQ_DIR="/opt/floq"
DEPLOY_USER="floq"

echo "═══════════════════════════════════════════"
echo "  Floq Production Sunucu Kurulumu"
echo "═══════════════════════════════════════════"

# ── 1. Sistem güncellemesi ────────────────────────────────────────────────────
echo "[1/6] Sistem güncelleniyor..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw fail2ban

# ── 2. Docker ─────────────────────────────────────────────────────────────────
echo "[2/6] Docker kuruluyor..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker
systemctl start docker

# ── 3. Deploy kullanıcısı ─────────────────────────────────────────────────────
echo "[3/6] Deploy kullanıcısı oluşturuluyor..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

# SSH authorized_keys kopyala (root'tan)
mkdir -p "/home/$DEPLOY_USER/.ssh"
cp /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/" 2>/dev/null || true
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null || true

# ── 4. Floq dizini ────────────────────────────────────────────────────────────
echo "[4/6] /opt/floq dizini hazırlanıyor..."
mkdir -p "$FLOQ_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$FLOQ_DIR"

# docker-compose.prod.yml ve Caddyfile GitHub'dan indir
GITHUB_REPO="${GITHUB_REPO:-veyselolam/floq.com}"
BRANCH="${BRANCH:-main}"
RAW_BASE="https://raw.githubusercontent.com/${GITHUB_REPO}/${BRANCH}"

sudo -u "$DEPLOY_USER" bash -c "
  cd $FLOQ_DIR
  curl -fsSL '$RAW_BASE/docker-compose.prod.yml' -o docker-compose.prod.yml
  curl -fsSL '$RAW_BASE/Caddyfile' -o Caddyfile
"

echo ""
echo "  .env.production dosyasını oluştur:"
echo "  sudo -u $DEPLOY_USER nano $FLOQ_DIR/.env.production"
echo ""
echo "  Şablon: https://raw.githubusercontent.com/${GITHUB_REPO}/${BRANCH}/.env.production.example"

# ── 5. Güvenlik duvarı ────────────────────────────────────────────────────────
echo "[5/6] UFW güvenlik duvarı yapılandırılıyor..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy → HTTPS yönlendirme)
ufw allow 443/tcp   # HTTPS
ufw allow 443/udp   # HTTP/3
ufw --force enable

# fail2ban SSH koruması
systemctl enable fail2ban
systemctl start fail2ban

# ── 6. SSH güvenlik ayarları ──────────────────────────────────────────────────
echo "[6/6] SSH sertleştiriliyor..."
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd

echo ""
echo "═══════════════════════════════════════════"
echo "  Kurulum tamamlandı!"
echo ""
echo "  Sonraki adımlar:"
echo "  1. $FLOQ_DIR/.env.production dosyasını düzenle"
echo "  2. GitHub Secrets'ı ayarla (bkz. README)"
echo "  3. main branch'e push yap → otomatik deploy"
echo ""
echo "  Manuel deploy:"
echo "  cd $FLOQ_DIR && docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
echo "═══════════════════════════════════════════"
