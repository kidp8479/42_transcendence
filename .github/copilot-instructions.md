# Copilot review instructions

Known, deliberate tradeoffs in this repo. Don't re-flag these as new issues —
they've already been discussed and the decision is intentional. Each entry
also has a comment at its source location, so this file mirrors what's in
the code rather than being the only place it's written down.

This file doubles as a living TODO list: if a "revisit when" condition below
becomes true, treat it as a real finding again.

## Category/event/member color indexing has no bounds check

`frontend/src/lib/categoryColorPalette.ts` — `CATEGORY_COLOR_PALETTE[x.color]`
(and its use for events/members) is indexed 0-7 with no modulo/wrap-around,
and category creation on the backend doesn't cap the count either. See the
file's own top-of-file comment for the full reasoning.

**Revisit when:** the team decides to allow more than 8 categories per
project, or a real (non-seed) project actually hits the limit.

## `import.meta.dirname` in `vite.config.ts`

`frontend/vite.config.ts` — flagged as a portability/Node-version risk.
Deliberate choice: Node 22 is pinned in every Dockerfile (frontend, backend,
auth), so `import.meta.dirname` (Node 20.11+) is safe here. `__dirname` was
explicitly rejected instead — it's `undefined` under ESM and broke `tsc -b`
in an earlier session.

**Revisit when:** Vite config ever needs to resolve outside Docker on an
older/unpinned Node version.

## Bare-integer Tailwind spacing values (`h-124`, `h-104`, `h-112`, ...)

`frontend/src/routes/_public/index.tsx` — Copilot has flagged these as
"not valid Tailwind classes" before. That's a Tailwind v3 assumption; this
repo runs Tailwind v4, which generates spacing for any bare integer
dynamically via `calc(var(--spacing) * N)`. Verified directly in the built
CSS output. Not a bug.

**Revisit when:** the project downgrades to Tailwind v3 (not planned).

## Auth service route naming (`/auth/register`, `/auth/login`)

`auth/internal/server/server.go` — some docs/comments elsewhere refer to an
`/auth/local/...` prefix that doesn't match the real routes. Known, low
severity, not blocking. Not fixed yet because renaming routes has real
churn cost (frontend `lib/auth.ts`, docs, tests) for a naming nit.

**Revisit when:** the auth routes get touched for another reason anyway —
fold the rename in then instead of a dedicated PR.

## Flat Compose network (no nginx/frontend ↔ Vault/db segmentation)

`docker-compose.yml` — all services share the default Compose network, so
nginx and the frontend container can technically reach `vault:8200` and
`db:5432`. Deliberate: the real authentication boundary is possession of a
per-workload AppRole `role_id`/`secret_id` file pair, and those are already
isolated in per-service volumes — network reach alone yields nothing.
Segmenting into edge/data/vault networks was reviewed and rejected as
disproportionate for a student project's local dev stack. See the comment
at the top of `docker-compose.yml`.

**Revisit when:** a production (non-dev-mode) Vault deployment is designed —
network policy is on the documented operational-blocker list for that phase.
