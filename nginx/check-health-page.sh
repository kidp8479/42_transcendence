#!/bin/sh
set -eu

case "${COMPOSE:-docker compose}" in
  "docker compose")
    compose() { docker compose "$@"; }
    ;;
  podman-compose)
    compose() { podman-compose "$@"; }
    ;;
  *)
    echo "Unsupported COMPOSE value: ${COMPOSE}" >&2
    exit 1
    ;;
esac

tmp_dir="$(mktemp -d)"
services_stopped=false

cleanup() {
  if [ "$services_stopped" = true ]; then
    compose start frontend backend auth >/dev/null || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

curl -ksS -D "$tmp_dir/page-headers" https://localhost:8443/health \
  -o "$tmp_dir/page-body"
grep -q "^HTTP/.* 200" "$tmp_dir/page-headers"
grep -qi "^cache-control: no-store, max-age=0" "$tmp_dir/page-headers"
grep -qi "^content-security-policy: default-src 'none'; script-src 'self';" "$tmp_dir/page-headers"
grep -q "Edge control panel" "$tmp_dir/page-body"

curl -ksS -D "$tmp_dir/css-headers" https://localhost:8443/health/status.css \
  -o "$tmp_dir/status.css"
grep -qi "^content-type: text/css" "$tmp_dir/css-headers"
grep -qi "^cache-control: no-store, max-age=0" "$tmp_dir/css-headers"

curl -ksS -D "$tmp_dir/javascript-headers" https://localhost:8443/health/status.js \
  -o "$tmp_dir/status.js"
grep -qi "^content-type: application/javascript" "$tmp_dir/javascript-headers"
grep -qi "^cache-control: no-store, max-age=0" "$tmp_dir/javascript-headers"

for endpoint in /api/health /auth/health; do
  curl -ksS -D "$tmp_dir/headers" "https://localhost:8443$endpoint" \
    -o "$tmp_dir/body"
  grep -q "^HTTP/.* 200" "$tmp_dir/headers"
  grep -qi "^content-type: application/json" "$tmp_dir/headers"
  grep -qi "^cache-control: no-store, max-age=0" "$tmp_dir/headers"
  grep -qx '{"status":"ok"}' "$tmp_dir/body"
done

status="$(curl -ksS -o /dev/null -w '%{http_code}' -X POST https://localhost:8443/api/health)"
[ "$status" = "405" ]
status="$(curl -ksS -o /dev/null -w '%{http_code}' https://localhost:8443/health/not-a-route)"
[ "$status" = "404" ]

compose stop frontend backend auth >/dev/null
services_stopped=true
sleep 1

curl -ksS -D "$tmp_dir/outage-page-headers" https://localhost:8443/health \
  -o "$tmp_dir/outage-page-body"
grep -q "^HTTP/.* 200" "$tmp_dir/outage-page-headers"
grep -q "Edge control panel" "$tmp_dir/outage-page-body"

for endpoint in /api/health /auth/health; do
  status="$(curl -ksS --max-time 5 -o /dev/null -w '%{http_code}' "https://localhost:8443$endpoint" || true)"
  [ "$status" = "502" ] || [ "$status" = "504" ]
done
