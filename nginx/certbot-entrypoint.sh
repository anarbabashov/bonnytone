#!/bin/sh
set -eu

# Renewal loop with a --deploy-hook that signals nginx to re-read certs.
# The deploy-hook uses the host docker socket (mounted read-only into this
# container) plus a docker-cli installed on first boot.

if ! command -v docker >/dev/null 2>&1; then
  apk add --no-cache docker-cli >/dev/null
fi

mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/sh
# Fires after every successful certificate renewal.
docker kill --signal=HUP btradio-nginx >/dev/null 2>&1 || true
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

trap exit TERM
while :; do
  certbot renew --quiet --no-random-sleep-on-renew || true
  sleep 12h & wait $!
done
