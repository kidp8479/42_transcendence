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
frontend_stopped=false

cleanup() {
  if [ "$frontend_stopped" = true ]; then
    compose start frontend >/dev/null || true
    attempts=0
    while [ "$attempts" -lt 15 ]; do
      frontend_status="$(curl -ksS -o /dev/null -w '%{http_code}' https://localhost:8443/ || true)"
      if [ "$frontend_status" = "200" ]; then
        break
      fi
      sleep 1
      attempts=$((attempts + 1))
    done
    [ "$frontend_status" = "200" ]
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

printf 'GET / HTTP/1.1\r\nHost: localhost\r\nBad Header\r\n\r\n' |
  openssl s_client -quiet -ign_eof -connect 127.0.0.1:8443 -servername localhost 2>/dev/null |
  grep -q "^HTTP/1.1 400 Bad Request"

curl -ksS -D "$tmp_dir/api-headers" https://localhost:8443/api/public/v1/token \
  -o "$tmp_dir/api-body"
grep -qi "^content-type: application/json" "$tmp_dir/api-headers"
grep -q "Project API token is invalid" "$tmp_dir/api-body"

curl -ksS -D "$tmp_dir/auth-headers" -H "Content-Type: application/json" \
  -H "Origin: https://localhost:8443" --data "{" https://localhost:8443/auth/login \
  -o "$tmp_dir/auth-body"
grep -qi "^content-type: application/json" "$tmp_dir/auth-headers"
grep -q "invalid JSON request body" "$tmp_dir/auth-body"

compose stop frontend >/dev/null
frontend_stopped=true
sleep 1

curl -ksS -D "$tmp_dir/frontend-headers" https://localhost:8443/ \
  -o "$tmp_dir/frontend-body"
grep -q "^HTTP/.* 502" "$tmp_dir/frontend-headers"
grep -q "Service temporarily unavailable" "$tmp_dir/frontend-body"
