*This project has been created as part of the 42 curriculum by cade-jes, cgajean, diade-so, pafroidu, abelov.*

## Description

**42 Project Planner** is a Trello-like collaborative project management web
app for 42 students to plan and track school projects as a team.

Each project has Discovery, Kanban, Calendar, Evaluation Checklist, and Summary
workspaces. Project members collaborate in real time through ticket-admitted
WebSockets, receive notifications, and can use project-bound API tokens for
reviewed external integrations.

## Instructions

### Local development

#### Prerequisites

- Docker with Docker Compose v2 (or Podman with `podman-compose` - the Makefile
  auto-detects which one is available; override with `make COMPOSE=podman-compose ...`
  if detection picks the wrong one)
- `make`

The default stack is the school-evaluation environment (Compose project
`transcendence-school`, `.env`). It serves the static frontend and production
service images through direct Compose ingress on ports 8080 and 8443. Bare
`make` is the same as `make start`: it builds images, starts the stack,
runs Prisma migrations, then seeds demo data - but only the first time. The
seed step records a local `.seed` marker file (ignored by Git) and is skipped
on every later `make`/`make start` while that marker exists:

```sh
make
```

The Makefile generates `.env` from `.env.example` with fresh local secrets and
the required `*.paris.42.school:8443` origin on first use (see
[Environment variables](#environment-variables)). `make up` starts the same
stack without rebuilding, migrating, or seeding - use it only when the images
and database are already in place.

For bind-mounted local development with Vite, NestJS, and Air hot reload, use
the explicit dev profile instead. It is a fully separate Compose project
(`transcendence-dev`), with its own env file (`.env.local`) and its own
one-time seed marker (`.seed.local`):

```sh
make start-dev
```

`make start-dev` builds images, starts the stack, migrates, and seeds once,
the same way `make start` does for the school profile. `make up-dev` starts
the existing dev containers without rebuilding, migrating, or seeding. Both
leave the school runtime environment unchanged.

#### Quick start

From the repository root:

```sh
make start-dev
```

Afterward, `make up-dev` starts the existing development containers without
rebuilding, migrating, or seeding.

When the containers are running, trust the local Vault PKI root in your
operating system or browser, then open
[https://localhost:8443](https://localhost:8443). Export the root certificate
with:

```sh
make export-local-ca
```

Port `8080` redirects to HTTPS on `8443`. The local root certificate is
development-only; do not install it on a shared or production machine.

You do not need to open the frontend container port directly. Docker Compose
publishes Nginx on local ports `8080` and `8443`; Nginx forwards requests to
the right service inside Docker.

Local routes:

- Frontend: [https://localhost:8443/](https://localhost:8443/)
- Backend API: [https://localhost:8443/api](https://localhost:8443/api)
- Backend WebSocket: [wss://localhost:8443/ws](wss://localhost:8443/ws)
- Auth service: [https://localhost:8443/auth](https://localhost:8443/auth)

If [https://localhost:8443](https://localhost:8443) does not load, check that
the stack is running:

```sh
make ps
make logs
```

If nginx cannot start because port `8080` is already in use, stop the other local service using that port, then run `make start-dev` again.

#### After pulling changes

**If the pull upgrades a major dependency** (e.g. Tailwind v3 to v4, a new bundler plugin), the existing `node_modules` volume inside Docker will be stale and must be rebuilt from scratch:

```sh
make start-dev
```

This is the safe default after any significant dependency change. It rebuilds the Docker images and reinstalls all packages cleanly.

**If the pull only adds or removes packages** without a major version change, a faster reinstall is enough:

```sh
make install-dev
```

This runs `npm install` inside the running containers without rebuilding the images.

If you are unsure which one to use, `make start-dev` is always safe.

If the pull includes changes to `prisma/schema.prisma`, the Prisma client is regenerated automatically the next time `npm install` runs (via the `postinstall` script), so `make install-dev` or `make start-dev` is enough. No manual `prisma generate` needed.

#### UI components

The frontend uses [Flowbite React](https://flowbite-react.com/docs/getting-started/introduction) as the component library and Tailwind CSS v4 for layout and spacing. Before building any new screen, check the style guide at [http://localhost:8080/dont-panic](http://localhost:8080/dont-panic). It shows the color palette, available components, and the conventions the team follows. These are temporary conventions to get everyone started with a shared base. The team can update the palette and style at any time in `frontend/src/index.css`.

#### Daily development flow

Use Docker Compose as the canonical local stack:

```sh
make start-dev
```

The frontend, backend, and auth services mount the local source folders into their containers, so normal source edits should hot reload without rebuilding Docker images.

Use the service logs while developing:

```sh
make logs-frontend-dev
make logs-backend-dev
make logs-auth-dev
```

Only rebuild when dependencies, Dockerfiles, or container setup changed:

```sh
make start-dev          # rebuild and start the full stack
make rebuild-frontend-dev  # rebuild only the frontend service
make rebuild-backend-dev   # rebuild only the backend service
make rebuild-auth-dev      # rebuild only the auth service
```

`make re-dev` is a full reset. It removes local development containers, local
images, and Docker volumes before starting again. Use it when you intentionally
want a clean rebuild, not for everyday development.

#### Linting and formatting

Both the frontend and backend use ESLint and Prettier. Three layers are in place:

**On demand** - requires the development stack to be running (`make start-dev` first):

```sh
make lint          # lint frontend and backend
make format        # format frontend and backend

make lint-frontend    # frontend only
make lint-backend     # backend only
make format-frontend  # frontend only
make format-backend   # backend only
```

**Pre-commit hook** - auto-formats and lints both services before every commit. Run after cloning, and again any time `hooks/pre-commit` itself changes (`.git/hooks/` is not tracked by git, so pulling an update to `hooks/pre-commit` does not update your locally installed copy on its own):

```sh
make hooks
```

After that, every `git commit` formats your files automatically and blocks the commit if ESLint finds errors. Note: the hook requires both the frontend and backend development containers to be running - if the stack is stopped, commits will be blocked until you run `make start-dev`.

**CI** - GitHub Actions runs ESLint and Prettier on every push for both services. Pull requests cannot be merged if either check fails.

`frontend/src/routeTree.gen.ts` is excluded from both tools - it is auto-generated by TanStack Router and should not be edited manually.

#### Optional fast frontend-only loop

For UI-only work, you can run Vite directly on the host for faster visual feedback:

```sh
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

This is only a frontend convenience loop. The canonical full development
application still runs through `make start-dev` and
[https://localhost:8443](https://localhost:8443).
If the frontend needs the API or WebSocket routes, keep the Docker stack
running with `VITE_API_URL=/api` and `VITE_WS_URL=/ws` so both target the
browser's loaded origin.

#### Environment variables

Default values live in `.env.example`. The school profile generates `.env`;
local development generates `.env.local`.

To discard the current local configuration and recreate it from the template:

```sh
make recreate-env
```

This overwrites the existing `.env` file.

42 OAuth is available when the configured client credentials and callback
origin are present. For the default school profile, set a concrete evaluator
hostname rather than the wildcard application origin:

```sh
AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN=https://f6r6s6.paris.42.school:8443
OAUTH_42_CLIENT_ID=
OAUTH_42_CLIENT_SECRET=
```

Register this exact redirect URI with 42:

```text
https://f6r6s6.paris.42.school:8443/auth/oauth/42/callback
```

Run `make` after changing the OAuth values so Compose reruns the Vault bootstrap
job, then run `make recreate-auth` to recreate Auth with the new callback
origin. Changing credentials directly in Vault only requires an Auth restart;
changing `AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN` requires recreation. Keep
these values private and do not commit `.env`. Google and GitHub variables
remain reserved for future providers.

Architecture and service contracts live in:

- `docs/architecture/authentication-authorization.yaml`
- `docs/contracts/auth-service.openapi.yaml`

#### Useful commands

```sh
make                  # build, start, migrate, and seed the school stack once
make up               # start the existing school stack only
make start-dev        # build, start, migrate, and seed the bind-mounted dev stack once
make up-dev           # start the existing dev stack only
make install-dev      # refresh dev node_modules volumes after package changes
make down             # stop the school stack
make down-dev         # stop the dev stack
make ps               # show school container status
make logs             # follow school logs
make logs-dev         # follow dev logs
make recreate-auth    # recreate school Auth without rebuilding its image
make lint            # lint frontend and backend
make format          # format frontend and backend
make lint-frontend   # lint frontend only
make lint-backend    # lint backend only
make format-frontend # format frontend only
make format-backend  # format backend only
make check-auth-stack # test Go auth and build backend/frontend in Compose
make hooks           # install the pre-commit hook (run once after cloning)
```

You can also start individual services when needed:

```sh
make up-db
make up-frontend
make up-backend
make up-auth
make rebuild-frontend
make rebuild-backend
make rebuild-auth
```

#### Shell access

```sh
make shell-frontend
make shell-backend
make shell-auth
make shell-db
```

#### Database commands

Run Prisma migrations from inside the backend container:

```sh
make migrate
```

For the bind-mounted dev environment, use `make migrate-dev`. To author a new
development migration, use `make migrate-create-dev NAME=lowercase-name`.

Stop the database and permanently remove its data volume:

```sh
make wipe-db
make up
make migrate
```

Open Prisma Studio without launching a browser in the container:

```sh
make prisma-studio
```

Inject demo data into the default school database:

```sh
make seed
```

It creates `.seed`; `make` skips later seed runs while that marker exists.
`make wipe-db` and `make fclean` remove it. The dev equivalents are
`make seed-dev`, `.seed.local`, `make wipe-db-dev`, and `make fclean-dev`.

#### Cleanup

```sh
make clean    # stop containers and remove orphans
make fclean   # also remove volumes and local images
make re       # reset and rebuild the school stack
make fclean-dev # remove dev containers, volumes, and local images
make re-dev     # reset and rebuild the dev stack
```

Use `make fclean` with care: it removes the PostgreSQL Docker volume, so local database data will be deleted.

## Team Information

| Member | Role | Focus |
| --- | --- | --- |
| Diana | Product Owner | Product direction and project settings |
| Pauline | Project Manager | Coordination, calendar, realtime UX, and notifications |
| Andrei | Technical Lead | Authentication, Vault, ingress, realtime security, and public API |
| Christophe | Architect | Cross-cutting architecture, storage, and chat |
| Carlos | Developer | Project workflows, Kanban, and search |

## Project Management

The team uses Notion for requirements and delivery tracking, Figma for UI
reference, GitHub for issues and pull requests, and Discord for daily
communication. Each feature uses an atomic Conventional Commit tagged with its
Task Rabbit ID and lands through a pull request.

GitHub Actions runs formatting, lint, and build checks. Branch protection keeps
unreviewed changes out of `main`.

## Technical Stack

- **Frontend:** React, TypeScript, Vite, TanStack Router, Tailwind CSS v4, and
  Flowbite React.
- **Backend:** NestJS, Prisma, Socket.io, and Swagger.
- **Authentication:** a dedicated Go service with Argon2id password hashing,
  JWT access tokens, refresh-token families, and one-time WebSocket tickets.
- **Data and storage:** PostgreSQL 16 and RustFS S3-compatible object storage.
- **Infrastructure:** Docker Compose, Nginx, ModSecurity/OWASP CRS, and
  HashiCorp Vault for dynamic database credentials and TLS material.

## Database Schema

`backend/prisma/schema.prisma` defines the project-management and authentication
domains. Projects own members, tasks, calendar events, categories, Discovery
blocks, evaluation items, and API tokens. Auth tables hold identities,
credentials, sessions, refresh-token families, WebSocket tickets, and audit
events; all are related to the shared user record.

## Features List

- Email/password accounts, refresh-token sessions, account-status enforcement,
  user profiles, and RustFS-backed avatars.
- Project creation, member roles, lifecycle management, and project-bound API
  tokens.
- Discovery, Kanban, Calendar, Evaluation Checklist, and Summary workspaces.
- Live updates, one-time ticket WebSocket admission, field locks, and
  notifications.
- Scoped cross-project search, public API documentation, and deployment-aware
  status reporting.

## Modules

The implementation covers the required framework, ORM, organization,
permissions, real-time, accessibility, notification, public API, and
cybersecurity modules. It uses React/NestJS, Prisma, Socket.io, project roles,
WCAG-focused UI work, project-bound API tokens, ModSecurity, and Vault.

Additional work in progress includes chat, friends, and extended search.

## Individual Contributions

Andrei owns auth, Vault, ingress, WebSocket admission, field locks, and public
API tokens. Pauline built core frontend/backend scaffolding and leads Calendar,
Discovery, realtime UX, notifications, and Summary. Christophe contributes
architecture, storage, avatars, user settings, Evaluation Checklist, and chat.
Diana contributes shared UI and Project Settings. Carlos contributes project
creation, Kanban, legal pages, and search.

## Resources

- [React](https://react.dev/) and
  [TanStack Router](https://tanstack.com/router/latest)
- [NestJS](https://docs.nestjs.com/) and
  [Prisma](https://www.prisma.io/docs)
- [Socket.io](https://socket.io/docs/v4/),
  [HashiCorp Vault](https://developer.hashicorp.com/vault/docs), and
  [Docker Compose](https://docs.docker.com/compose/)
- [OWASP Core Rule Set](https://coreruleset.org/) and
  [WCAG 2.1](https://www.w3.org/TR/WCAG21/)
