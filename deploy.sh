#!/bin/bash
# Deploy Klidná Praha to s1.neotek.cz → klidnapraha.fun
# Run this script on the SERVER after cloning/pulling the repo.
set -e

APP_DIR="/home/andrii/klidnapraha"
NGINX_CONF="/etc/nginx/sites-enabled/andrii/klidnapraha.conf"
DOMAIN="klidnapraha.fun"

echo "═══ 1. Pulling latest code ═══"
cd "$APP_DIR"
git pull

echo "═══ 2. Setting up Nginx (HTTP only — for certbot) ═══"
# First deploy: install HTTP-only config so certbot can verify
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "No SSL cert found, installing HTTP-only config first..."

    # Temporary HTTP-only config for ACME challenge
    sudo tee "$NGINX_CONF" > /dev/null <<'HTTPCONF'
server {
    listen 80;
    server_name klidnapraha.fun www.klidnapraha.fun;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Setting up...';
        add_header Content-Type text/plain;
    }
}
HTTPCONF

    sudo mkdir -p /var/www/certbot
    sudo nginx -t && sudo systemctl reload nginx

    echo "═══ 3. Obtaining SSL certificate ═══"
    sudo certbot certonly --webroot -w /var/www/certbot \
        -d "$DOMAIN" -d "www.$DOMAIN" \
        --non-interactive --agree-tos --email andrii@neotek.cz

    echo "SSL certificate obtained!"
fi

echo "═══ 4. Installing full Nginx config (with SSL) ═══"
sudo cp "$APP_DIR/nginx-klidnapraha.conf" "$NGINX_CONF"
sudo nginx -t && sudo systemctl reload nginx

echo "═══ 5. Starting Docker containers ═══"
cd "$APP_DIR"
sudo docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ Deployed! https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  sudo docker compose -f $APP_DIR/docker-compose.prod.yml logs -f"
echo "  sudo docker compose -f $APP_DIR/docker-compose.prod.yml restart"
echo "  sudo docker compose -f $APP_DIR/docker-compose.prod.yml down"
