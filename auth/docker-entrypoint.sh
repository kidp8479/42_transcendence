#!/bin/sh
# Runs as root (see USER root at the end of the dev stage) so it can fix
# ownership regardless of how the "app" user's uid maps at runtime - e.g.
# under rootless Podman's --userns keep-id, files chowned to a given uid at
# *build* time (a plain, unmapped uid) do not necessarily match that same uid
# as seen by a running container (a remapped uid inside the user namespace).
# This mismatch is invisible for the bind-mounted source tree (chowned
# correctly at build time and also visible correctly at runtime through the
# bind mount), but affects /home/app (the Go build cache lives under
# /home/app/.cache), which is part of the image filesystem rather than the
# bind mount and can end up owned by a uid that doesn't resolve to "app"
# under the active namespace.
set -e
chown -R app:app /home/app 2>/dev/null || true
exec su-exec app "$@"
