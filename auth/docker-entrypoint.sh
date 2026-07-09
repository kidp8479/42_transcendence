#!/bin/sh
# Runs as root (the default now, since the Dockerfile no longer switches user
# during build - see the Dockerfile for why) so it can chown /home/app before
# dropping privileges. The bind-mounted source tree at /app needs no chown
# here: rootless Podman's --userns keep-id remaps it live from the real host
# file ownership, regardless of what was baked in at *build* time. /home/app
# (the Go build cache lives under /home/app/.cache) is different - it's part
# of the image filesystem rather than the bind mount, built as root since the
# Dockerfile no longer switches user during build, so it needs fixing up once
# the container is actually running under its real runtime namespace.
set -e
chown -R app:app /home/app 2>/dev/null || true
exec su-exec app:app "$@"
