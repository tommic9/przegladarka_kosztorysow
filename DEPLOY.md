# Instrukcja wdrożenia — Zestawienia materiałów

## Architektura

```
Internet → Cloudflare Edge (SSL) → cloudflared tunnel → LXC Debian 12 → Next.js (PM2, port 3000) → SQLite (NVMe)
```

---

## Krok 1: Utwórz LXC w Proxmox

W interfejsie Proxmox → **Create CT**:

| Parametr | Wartość |
|----------|---------|
| Template | Debian 12 (bookworm) |
| CPU | 2 vCPU |
| RAM | 2048 MB |
| Storage | 20 GB na NVMe (`local-lvm` lub właściwy pool NVMe) |
| Network | DHCP (bridge `vmbr0`) |
| Hostname | `zestawienia` |

Po utworzeniu zaloguj się do konsoli LXC.

---

## Krok 2: Przygotuj system

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential python3

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PM2
npm install -g pm2

# Weryfikacja
node --version  # v20.x
npm --version
pm2 --version
```

---

## Krok 3: Wgraj aplikację

Na swoim Windows skompiluj aplikację:

```bash
# W D:\DEV\Zestawienia materiałów\
npm run build
```

Skopiuj pliki na serwer (opcje):

**Opcja A — rsync (z WSL lub Git Bash):**
```bash
rsync -av --exclude 'node_modules' --exclude '.next' --exclude 'data' \
  "D:/DEV/Zestawienia materiałów/" \
  root@192.168.1.X:/opt/zestawienia/
```

**Opcja B — git (jeśli repo na GitHubie/Gitea):**
```bash
cd /opt
git clone https://github.com/TWOJE_REPO/zestawienia.git
cd zestawienia
```

Na serwerze:
```bash
cd /opt/zestawienia
npm install --production
npm run build  # jeśli nie budowałeś wcześniej
mkdir -p data uploads
```

---

## Krok 4: Zmienne środowiskowe

```bash
nano /opt/zestawienia/.env.local
```

Zawartość:
```
JWT_SECRET=wygeneruj_losowy_ciag_min_32_znaki_np_openssl_rand_hex_32
ADMIN_EMAIL=twoj@email.pl
ADMIN_PASSWORD=silne_haslo_admina
ADMIN_NAME=Twoje Imię
DATABASE_PATH=/opt/zestawienia/data/database.sqlite
```

Generowanie JWT_SECRET:
```bash
openssl rand -hex 32
```

---

## Krok 5: Utwórz konto admina

```bash
cd /opt/zestawienia
npx tsx src/scripts/seed.ts
```

---

## Krok 6: Uruchom z PM2

```bash
cd /opt/zestawienia

# Utwórz plik konfiguracji PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'zestawienia',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/opt/zestawienia',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Start
pm2 start ecosystem.config.js

# Autostart po restarcie systemu
pm2 startup
pm2 save

# Status
pm2 status
pm2 logs zestawienia
```

Aplikacja dostępna lokalnie: `http://192.168.1.X:3000`

---

## Krok 7: Cloudflare Tunnel (po zakupie domeny)

### 7.1 Konfiguracja DNS domeny w Cloudflare

1. Kup domenę (np. `.pl` na home.pl, OVH)
2. Zmień nameservery domeny na te od Cloudflare (podane po dodaniu domeny w Cloudflare)
3. Poczekaj na propagację DNS (kilka godzin)

### 7.2 Zainstaluj cloudflared

```bash
# Debian/Ubuntu
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o cloudflared.deb
dpkg -i cloudflared.deb

# Autoryzacja (otworzy link w przeglądarce)
cloudflared tunnel login
```

### 7.3 Utwórz tunel

```bash
cloudflared tunnel create zestawienia

# Wypisz ID tunelu
cloudflared tunnel list
```

### 7.4 Konfiguracja tunelu

```bash
mkdir -p /etc/cloudflared
nano /etc/cloudflared/config.yml
```

Zawartość (podmień `TUNNEL_ID` i domenę):
```yaml
tunnel: TUNNEL_ID
credentials-file: /root/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: zestawienia.twojadomena.pl
    service: http://localhost:3000
  - service: http_status:404
```

### 7.5 Skieruj domenę na tunel

```bash
cloudflared tunnel route dns zestawienia zestawienia.twojadomena.pl
```

### 7.6 Uruchom cloudflared jako usługę systemową

```bash
cloudflared service install
systemctl start cloudflared
systemctl enable cloudflared
systemctl status cloudflared
```

Aplikacja dostępna pod: `https://zestawienia.twojadomena.pl`

---

## Backup bazy danych (opcjonalnie, dysk 2TB USB)

Sprawdź punkt montowania dysku USB:
```bash
lsblk
# /dev/sda1 zamontowany np. w /mnt/backup
```

Skrypt backupu `/opt/backup-db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/mnt/backup/zestawienia"
mkdir -p "$BACKUP_DIR"
cp /opt/zestawienia/data/database.sqlite \
   "$BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).sqlite"

# Zachowaj tylko ostatnie 30 kopii
ls -t "$BACKUP_DIR"/database_*.sqlite | tail -n +31 | xargs rm -f
```

Cron (backup codziennie o 3:00):
```bash
chmod +x /opt/backup-db.sh
crontab -e
# Dodaj:
0 3 * * * /opt/backup-db.sh
```

---

## Aktualizacja aplikacji

```bash
cd /opt/zestawienia
git pull                    # lub skopiuj nowe pliki
npm install
npm run build
pm2 restart zestawienia
```

---

## Przydatne komendy

```bash
pm2 logs zestawienia        # logi aplikacji
pm2 restart zestawienia     # restart
pm2 stop zestawienia        # zatrzymanie
systemctl status cloudflared # status tunelu Cloudflare
journalctl -u cloudflared   # logi tunelu
sqlite3 data/database.sqlite ".tables"  # sprawdź bazę
```
