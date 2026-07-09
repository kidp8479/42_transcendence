#!/bin/sh
# Runs as root (the default now, since the Dockerfile no longer switches user
# during build - see the Dockerfile for why) so it can chown the named
# node_modules volume before dropping privileges. The bind-mounted source
# tree needs no chown here: rootless Podman's --userns keep-id remaps it live
# from the real host file ownership, regardless of what was baked in at
# *build* time. The named volume is different - its content is populated by
# the container engine from the image layer (built as root, since the
# Dockerfile no longer switches user during build), so it needs fixing up
# once the container is actually running under its real runtime namespace.
set -e
chown -R node:node /app/node_modules 2>/dev/null || true
exec su-exec node:node "$@"
