#!/bin/sh

set -eu

certificate_fingerprint() {
	sha256sum /etc/nginx/ssl/local.pem /etc/nginx/ssl/paris-42-wildcard.pem 2>/dev/null |
		sha256sum |
		awk '{ print $1 }'
}

(
	previous=$(certificate_fingerprint)
	while sleep 60; do
		current=$(certificate_fingerprint)
		if [ -n "$current" ] && [ "$current" != "$previous" ]; then
			nginx -s reload
			previous=$current
		fi
	done
) &
