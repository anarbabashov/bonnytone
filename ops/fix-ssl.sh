#!/usr/bin/env bash
# Recovery script for the expired Let's Encrypt cert on bonnytone.com.
#
# Usage on the VPS (paste-and-run):
#   sudo bash fix-ssl.sh           # diagnose only (no changes)
#   sudo bash fix-ssl.sh --apply   # actually fix
#
# Idempotent. Safe to re-run. Backs up any file it overwrites.
#
# What it does in --apply mode:
#   1. Backs up and rewrites nginx/conf.d/btradio.conf so /.well-known/acme-challenge/
#      is served from /var/www/certbot (current config returns 404 there).
#   2. Reloads nginx and verifies the ACME path returns 200 (loopback + public).
#   3. Runs `certbot renew --dry-run`, then `--force-renewal`.
#   4. Reloads nginx so it picks up the new cert.
#   5. Installs a deploy-hook inside the certbot container so future renewals
#      auto-reload nginx (current setup never does).
#   6. Validates externally with openssl + curl.

set -euo pipefail

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

NGINX=btradio-nginx
CERTBOT=btradio-certbot
DOMAIN=bonnytone.com
SAN=www.bonnytone.com
WEBROOT_CT=/var/www/certbot

step()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
die()   { printf '\033[1;31mFATAL: %s\033[0m\n' "$*" >&2; exit 1; }

docker ps >/dev/null 2>&1 || die "cannot talk to docker (rerun with sudo, or add yourself to the docker group)"

for c in "$NGINX" "$CERTBOT"; do
  state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || true)
  [ "$state" = "running" ] || die "$c is not running (status: ${state:-not found}). Start it with: docker compose -f /path/to/docker-compose.prod.yml up -d"
done

PROJ_DIR=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$NGINX")
[ -n "$PROJ_DIR" ] && [ -d "$PROJ_DIR" ] || die "could not locate compose project dir for $NGINX (label missing). Pass it manually: PROJ_DIR=/path bash $0"
CONF_HOST="$PROJ_DIR/nginx/conf.d/btradio.conf"
[ -f "$CONF_HOST" ] || die "expected nginx conf at $CONF_HOST"

step "Environment"
printf 'project dir : %s\n' "$PROJ_DIR"
printf 'nginx conf  : %s\n' "$CONF_HOST"
printf 'utc time    : %s\n' "$(date -u)"
timedatectl status 2>/dev/null | sed -n '1,4p' || true

step "Current external cert"
echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null \
  | openssl x509 -noout -subject -dates -ext subjectAltName 2>/dev/null || true

step "ACME path probe (before)"
docker exec "$CERTBOT" sh -c "mkdir -p $WEBROOT_CT/.well-known/acme-challenge && echo probe-\$(date +%s) > $WEBROOT_CT/.well-known/acme-challenge/_probe"
LOCAL=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $DOMAIN" http://127.0.0.1/.well-known/acme-challenge/_probe || true)
PUBLIC=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 http://$DOMAIN/.well-known/acme-challenge/_probe || true)
docker exec "$CERTBOT" rm -f "$WEBROOT_CT/.well-known/acme-challenge/_probe" || true
printf 'loopback : HTTP %s\n' "$LOCAL"
printf 'public   : HTTP %s\n' "$PUBLIC"

NEED_NGINX_FIX=0
[ "$LOCAL" != "200" ] && NEED_NGINX_FIX=1
if [ "$LOCAL" = "200" ] && [ "$PUBLIC" != "200" ]; then
  die "loopback works but public does not — port 80 is firewalled or there is a proxy/CDN in front. Check OVH firewall + DNS for Cloudflare proxy before re-running."
fi

if [ "$APPLY" = "0" ]; then
  cat <<EOF

(diagnostic only — re-run with --apply to fix)

Planned actions:
  $( [ "$NEED_NGINX_FIX" = "1" ] && echo "[Y] rewrite $CONF_HOST (port-80 block) and back up the original" || echo "[ ] skip nginx rewrite (config looks good)" )
  [Y] certbot renew --dry-run, then --force-renewal
  [Y] docker exec $NGINX nginx -s reload
  [Y] install /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh inside $CERTBOT
EOF
  exit 0
fi

# ====== APPLY MODE ======

if [ "$NEED_NGINX_FIX" = "1" ]; then
  step "Backing up + rewriting nginx config"
  TS=$(date -u +%Y%m%dT%H%M%SZ)
  cp -a "$CONF_HOST" "$CONF_HOST.bak-$TS"
  printf 'backup : %s\n' "$CONF_HOST.bak-$TS"

  # Preserve the existing port-443 server block; replace only the port-80 block.
  perl -0777 -i -pe '
    my $new = <<"BLOCK";
# HTTP -> HTTPS redirect + ACME HTTP-01 webroot
# /.well-known/acme-challenge/ MUST be served before the catch-all 301,
# otherwise certbot renewal fails silently.
server {
    listen 80 default_server;
    server_name bonnytone.com www.bonnytone.com;

    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/certbot;
    }

    location = /.well-known/acme-challenge/ {
        return 404;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
BLOCK
    if (m/server\s*\{[^{}]*listen\s+80\b[^{}]*\}/s) {
      s/server\s*\{[^{}]*listen\s+80\b[^{}]*\}/$new/s;
    } else {
      $_ = $new . "\n" . $_;
    }
  ' "$CONF_HOST"

  step "nginx -t (validate new config)"
  docker exec "$NGINX" nginx -t

  step "nginx -s reload"
  docker exec "$NGINX" nginx -s reload

  step "ACME path probe (after rewrite)"
  docker exec "$CERTBOT" sh -c "echo postpatch-\$(date +%s) > $WEBROOT_CT/.well-known/acme-challenge/_probe2"
  LOCAL2=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $DOMAIN" http://127.0.0.1/.well-known/acme-challenge/_probe2 || true)
  PUBLIC2=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 http://$DOMAIN/.well-known/acme-challenge/_probe2 || true)
  docker exec "$CERTBOT" rm -f "$WEBROOT_CT/.well-known/acme-challenge/_probe2" || true
  printf 'loopback : HTTP %s\n' "$LOCAL2"
  printf 'public   : HTTP %s\n' "$PUBLIC2"
  [ "$LOCAL2" = "200" ] && [ "$PUBLIC2" = "200" ] || die "ACME path still failing after patch. Restore: cp $CONF_HOST.bak-$TS $CONF_HOST && docker exec $NGINX nginx -s reload"
fi

step "Install deploy-hook inside certbot container"
docker exec "$CERTBOT" sh -c '
  mkdir -p /etc/letsencrypt/renewal-hooks/deploy
  cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<"EOF"
#!/bin/sh
docker kill --signal=HUP btradio-nginx >/dev/null 2>&1 || true
EOF
  chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
'
if ! docker exec "$CERTBOT" ls /var/run/docker.sock >/dev/null 2>&1; then
  warn "/var/run/docker.sock is NOT mounted into $CERTBOT — the deploy-hook will be inert until you pull the updated docker-compose.prod.yml (which adds the socket bind + entrypoint script) and run:"
  warn "  docker compose -f $PROJ_DIR/docker-compose.prod.yml up -d --force-recreate certbot"
  warn "Until then, the host-side cron below will keep things alive."
fi

step "certbot renew --dry-run"
docker exec "$CERTBOT" certbot renew --dry-run 2>&1 | tail -20

step "certbot renew --force-renewal"
docker exec "$CERTBOT" certbot renew --force-renewal --no-random-sleep-on-renew

step "nginx -s reload (load new cert)"
docker exec "$NGINX" nginx -s reload

step "Install host-side cron safety net (twice daily)"
install -m 644 /dev/stdin /etc/cron.d/btradio-cert-renew <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3,15 * * * root docker exec $CERTBOT certbot renew --quiet && docker exec $NGINX nginx -s reload >/dev/null 2>&1
EOF
systemctl reload cron 2>/dev/null || systemctl restart cron 2>/dev/null || true
echo "wrote /etc/cron.d/btradio-cert-renew"

step "External validation"
sleep 2
echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null
echo
curl -sI --max-time 15 "https://$DOMAIN"  | head -3
echo
curl -sI --max-time 15 "https://$SAN" | head -3

step "Done"
cat <<EOF

Cert renewed. nginx reloaded. Host cron and in-container loop are both active.

To make the in-container deploy-hook fully active (and remove dependence on
the host cron), pull the latest repo on this VPS and recreate the certbot
container:

  cd $PROJ_DIR
  git pull
  docker compose -f docker-compose.prod.yml up -d --force-recreate certbot

That picks up the new ./nginx/certbot-entrypoint.sh + docker.sock bind.
EOF
