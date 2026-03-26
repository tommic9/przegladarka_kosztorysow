#!/bin/bash
set -e

SERVER="user@192.168.1.xxx"   # <-- zmień na adres serwera
REMOTE_DIR="/opt/zestawienia"

echo "==> Budowanie obrazu..."
docker build -t zestawienia-mat:latest .

echo "==> Eksportowanie obrazu..."
docker save zestawienia-mat:latest | gzip > zestawienia-mat.tar.gz

echo "==> Wysyłanie na serwer..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"
scp zestawienia-mat.tar.gz "$SERVER:$REMOTE_DIR/"
scp docker-compose.prod.yml "$SERVER:$REMOTE_DIR/docker-compose.yml"
scp .env.docker "$SERVER:$REMOTE_DIR/"

echo "==> Ładowanie obrazu i restart..."
ssh "$SERVER" "
  cd $REMOTE_DIR
  docker load < zestawienia-mat.tar.gz
  docker compose up -d
  docker compose logs --tail=20
"

echo "==> Sprzątanie lokalnie..."
rm zestawienia-mat.tar.gz

echo "==> Gotowe!"
