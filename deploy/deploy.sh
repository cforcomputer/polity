#!/bin/sh
# Build Polity and ship it to the Hetzner box that also runs Philform.
#   deploy/deploy.sh            build + code
#   deploy/deploy.sh --setup    also the user, systemd unit and Caddy site
# SSH comes from the applicator project (host "philform"). Secrets live in /etc/polity.env.
set -e
cd "$(dirname "$0")/.."
SSH="ssh -F $HOME/Desktop/applicator/.dev/ssh/config"
rm -rf .next  # a stale Turbopack cache can ship old CSS
npx next build
# Standalone output needs the static assets and public folder beside server.js.
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public
if [ "$1" = "--setup" ]; then
  $SSH philform 'id polity >/dev/null 2>&1 || sudo useradd --system --no-create-home --shell /usr/sbin/nologin polity
    sudo install -d -m 755 /opt/polity /etc/caddy/sites
    sudo install -d -m 750 -o polity -g polity /var/lib/polity'
  rsync -az -e "$SSH" --rsync-path="sudo rsync" deploy/polity.service philform:/etc/systemd/system/polity.service
  rsync -az -e "$SSH" --rsync-path="sudo rsync" deploy/polity.caddy philform:/etc/caddy/sites/polity.caddy
  $SSH philform 'grep -q "import /etc/caddy/sites/\*.caddy" /etc/caddy/Caddyfile || echo "
import /etc/caddy/sites/*.caddy" | sudo tee -a /etc/caddy/Caddyfile >/dev/null
    sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl daemon-reload && sudo systemctl enable polity && sudo systemctl reload caddy'
fi
rsync -az --delete -e "$SSH" --rsync-path="sudo rsync" .next/standalone/ philform:/opt/polity/
$SSH philform 'sudo chown -R root:root /opt/polity && sudo systemctl restart polity && sleep 3 && curl -fsS -o /dev/null -w "local %{http_code}\n" http://127.0.0.1:3200/api/session'
