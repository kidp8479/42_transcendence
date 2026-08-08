*This project has been created as part of the 42 curriculum by cade-jes, cgajean, diade-so, pafroidu, abelov.*

## Description

**42 Project Planner** is a Trello-like collaborative project management web
app for 42 students to plan and track school projects as a team.

Each project has Discovery, Kanban, Calendar, Evaluation Checklist, and Summary
workspaces. Project members collaborate in real time through ticket-admitted
WebSockets, receive notifications, and can use project-bound API tokens for
reviewed external integrations.

## Instructions

### Prerequisites

- **Docker Engine** with the **Compose v2 plugin** (Podman + `podman-compose` also works, auto-detected).
- **GNU Make**.
- **OpenSSL** - used on the host to generate local secrets (`.env` values); preinstalled on Linux/macOS, available through WSL2 on Windows.
- **Git**.

No other host tooling is required. Node, npm, and every language runtime run inside the containers, not on the host.

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

Once it finishes, trust the local TLS certificate so the browser stops warning about it:

```sh
make export-local-ca
```

This drops the certificate authority at `.local/task-rabbit-local-ca.crt`. Import it into your OS/browser's trusted root certificate store, then open **https://localhost:8443**.

Sign in with a seeded demo account (`<username>@42.fr`, password is the current `SEED_PASSWORD` value inside your local `.env` - it's regenerated on every `rere`, there is no fixed shared password) or create your own account.

### Configuration

Every environment variable the app needs is documented in `.env.example`. `make recreate-env` (called by `rere`) copies it to `.env` and replaces every secret-bearing value with a fresh random one; `.env` itself is git-ignored and never committed. OAuth login (42, Google) is optional - leave `OAUTH_42_CLIENT_ID`/`OAUTH_GOOGLE_CLIENT_ID` blank to keep those buttons hidden, or fill in real provider credentials to enable them.

### Everyday commands

| Command | What it does |
| --- | --- |
| `make up` / `make down` | Start or stop the stack without rebuilding. |
| `make up-build` | Rebuild images and start (after pulling dependency changes). |
| `make logs` | Follow every service's logs. |
| `make ps` | Show container status. |
| `make help` | List every available target. |

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

**Pre-commit hook** - checks only the application areas staged by the commit:
frontend changes are formatted and linted, backend changes are formatted and
linted, and Auth changes are formatted. Documentation, Compose, and other
non-application commits do not require a running development stack. Run after
cloning, and again any time `hooks/pre-commit` itself changes (`.git/hooks/` is
not tracked by git, so pulling an update to `hooks/pre-commit` does not update
your locally installed copy on its own):

```sh
make hooks
```

For staged application changes, the hook formats files automatically and blocks
the commit if ESLint finds errors. Those checks require the matching development
containers, so run `make start-dev` before committing application changes.

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

For an isolated VM or production deployment, see
[`docs/operations/manual-production-deployment.md`](docs/operations/manual-production-deployment.md).

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

### Frontend

- **React 19 + Vite + TypeScript** - the mandatory frontend framework. Vite gives fast local rebuilds during development time; TypeScript catches a large class of bugs before they reach the browser.
- **TanStack Router** - file-based routing with typed params and route loaders. Data fetching goes through route `loader`s each route asks for exactly the data it needs when it's entered, and `router.invalidate()` refreshes it after a mutation. Simpler mental model for a team new to data-fetching patterns.
- **Tailwind CSS v4 + Flowbite React** - covers the mandatory CSS framework requirement. Flowbite supplies accessible, pre-built components (modals, dropdowns, forms) on top of Tailwind, so the team spends less time re-solving basic UI accessibility.
- **Socket.io client** - the browser side of the realtime layer (see Backend below).

### Backend

- **NestJS + TypeScript** - the mandatory backend framework. Its module system (one module per feature: projects, tasks, calendar, etc.) keeps a five-person team's work isolated by folder, and it ships WebSocket gateways, guards, and Swagger generation out of the box.
- **Prisma ORM** - covers the mandatory ORM requirement. A single schema file defines every table and relation, generates type-safe queries, and manages migrations.
- **Socket.io** - the realtime layer behind live updates on Discovery, the Evaluation Checklist, project member management, and Calendar, plus notifications and field locks (shows who's editing what, live, to avoid two people overwriting each other).
- **Swagger** - auto-generated interactive API documentation from the same NestJS decorators used for routing, which directly covers the Public API module's documentation requirement with no separate writing effort.

### Auth

A dedicated **Go service**, separate from the NestJS backend. Authentication is security-sensitive and easy to get subtly wrong; keeping it in its own small, focused service makes it easier to audit and test in isolation, and lets it fail closed without taking the rest of the API down with it.

- Argon2id password hashing (salted, memory-hard - resistant to GPU cracking).
- JWT access tokens + refresh token families (short-lived access token, longer-lived refresh token that can be rotated and revoked).
- HashiCorp Vault issues short-lived, dynamically-generated PostgreSQL credentials to both the Go service and the NestJS backend, instead of a static shared password.

### Database

**PostgreSQL 16** - a relational database fits this project's data well: projects, tasks, calendar events, and their relationships (who's a member of what, who's assigned to what) are naturally foreign-key relationships, and Postgres handles concurrent writes correctly, which the subject's mandatory multi-user requirement depends on.

### Storage

**RustFS** (S3-compatible object storage) for user avatars and uploaded files, instead of storing binary data directly in Postgres or on the container's local disk (which wouldn't survive a container rebuild).

### Infrastructure

- **Docker + Docker Compose** - covers the mandatory containerized, single-command deployment requirement. One `docker compose up` starts every service (frontend, backend, auth, database, Vault, storage, nginx).
- **Nginx** - the single entrypoint (port 8080 locally, [deployed version is](https://tomato.iops.dev/)) in front of every service. The browser only ever talks to nginx, which forwards each request to the right service internally.

## Database Schema

`backend/prisma/schema.prisma` defines the project-management and authentication
domains. Projects own members, tasks, calendar events, categories, Discovery
blocks, evaluation items, and API tokens. Auth tables hold identities,
credentials, sessions, refresh-token families, WebSocket tickets, and audit
events; all are related to the shared user record.

## Features List

### Authentication & accounts

- **Email/password signup and login** - Argon2id password hashing, HttpOnly session cookie, CSRF token. *Andrei*
- **JWT + refresh-token-family session model** - short-lived access tokens, rotating refresh tokens, family-wide revocation if a stolen token is reused. *Andrei*
- **Account status enforcement** - suspended/disabled accounts are blocked at the auth layer, not just hidden in the UI. *Andrei*
- **Avatar upload** - drag-and-drop or click-to-browse, stored in RustFS. *Christophe*
- **User settings** - update profile info, avatar, security preferences. *Christophe*

### Landing & public pages

- **Landing page** - marketing page with a feature carousel, CTAs to sign up/log in. *Pauline*
- **Public/authenticated header, navigation, sidebar** - shared chrome across the whole app. *Andrei, Christophe, Diana*
- **Footer + legal pages** - real Privacy Policy and Terms of Service content, linked from the footer. *Carlos*

### Projects

- **Project list + creation** - in-place card that morphs into a create form. *Carlos*
- **Project membership & roles** - `OWNER` / `ADMIN` / `MEMBER`, shared membership-check used across every feature. *Andrei, Diana*
- **Project settings** - rename, archive, delete a project; add/remove members; change roles. *Diana*
- **Project-bound public API tokens** - create/reveal/revoke API keys scoped to one project, with READ / READ_WRITE permission and rate limiting. *Andrei*

### Core project workspace

- **Discovery tab** - checklist blocks (with notes, color, icon) for laying out the subject before writing code. *Pauline*
- **Kanban board** - drag-and-drop tasks across To Do / In Progress / Review / Completed, with categories, priorities, and assignees. *Carlos, Pauline*
- **Calendar** - month view, categorized events, per-event assignees. *Pauline*
- **Evaluation Checklist** - Mandatory / Bonus / Supplemental sections tracking defense readiness. *Christophe*
- **Summary dashboard** - per-project overview (task status, progress by category, team workload, upcoming events, defense readiness), wired to real data from every other tab. *Pauline*

### Realtime & notifications

- **WebSocket layer** - per-user rooms, live updates broadcast to every connected client. *Pauline*
- **One-time WebSocket ticket admission** - short-lived, single-use tickets for WebSocket auth. *Andrei*
- **Field locks** - shows who's currently editing a field, so two people can't silently overwrite each other. *Andrei*
- **Notification system** - in-app notifications on assignment, removal, and completion events across tasks, calendar events, checklist, and project membership. *Pauline*

### Infrastructure

- **App scaffolding & bootstrap** - initial TanStack Router + React frontend and NestJS backend setup that every feature builds on. *Christophe, Pauline, Diana*
- **Docker Compose stack** - single-command local deployment of every service. *Andrei*
- **HashiCorp Vault** - dynamic, short-lived PostgreSQL credentials instead of a static shared password; Vault-backed migration authoring. *Andrei*
- **RustFS storage** - S3-compatible object storage for avatars and file uploads. *Christophe*

### In progress

- **Group chat & friends** - basic messaging and a friends list between project members. *Christophe*
- **Search bar** - workspace-wide search across projects, tasks, and members. *Carlos*

## Modules

The implementation covers the required framework, ORM, organization,
permissions, real-time, accessibility, notification, public API, and
cybersecurity modules. It uses React/NestJS, Prisma, Socket.io, project roles,
WCAG-focused UI work, project-bound API tokens, ModSecurity, and Vault.

### Mandatory (14 points required, 20 implemented)

| Module | Type | Pts | Implemented by |
|---|---|---|---|
| Use a framework for both the frontend and backend | Web, Major | 2 | whole team |
| Implement real-time features using WebSockets | Web, Major | 2 | Pauline, Andrei |
| A public API with a secured API key, rate limiting, and documentation | Web, Major | 2 | Andrei |
| An organization system | User Management, Major | 2 | Andrei, Diana, Christophe |
| Advanced permissions system | User Management, Major | 2 | Andrei, Diana, Christophe |
| Complete accessibility compliance (WCAG 2.1 AA) | Accessibility, Major | 2 | whole team |
| WAF/ModSecurity + HashiCorp Vault | Cybersecurity, Major | 2 | Andrei |
| Use an ORM for the database | Web, Minor | 1 | whole team |
| Real-time collaborative features | Web, Minor | 1 | Pauline, Christophe, Diana |
| A complete notification system | Web, Minor | 1 | Pauline |
| User activity analytics and insights dashboard | User Management, Minor | 1 | Pauline |
| Support for additional browsers | Accessibility, Minor | 1 | whole team |
| Advanced search functionality | Web, Minor | 1 | Carlos |

- **Framework (Major)**: React (frontend) and NestJS (backend), both from the app's initial scaffolding.
- **WebSockets (Major)**: a Socket.io gateway with per-user rooms, powering live updates on Discovery, the Evaluation Checklist, project membership, and Calendar, plus notifications and field locks.
- **Public API (Major)**: project-bound API tokens (`READ` / `READ_WRITE`), rate-limited writes, Swagger-documented endpoints under `/api/public/v1`.
- **Organization system (Major)**: a `Project` is this app's organizational unit - create/edit/delete a project, add/remove members, manage roles.
- **Advanced permissions (Major)**: `OWNER` / `ADMIN` / `MEMBER` roles per project, with different views and actions available depending on role (e.g. only `OWNER`/`ADMIN` can remove members or delete the project).
- **Accessibility compliance (Major)**: a page-by-page pass across the app has fixed contrast, focus rings, semantic HTML, and ARIA labeling on our pages.
- **WAF/ModSecurity + HashiCorp Vault (Major)**: OWASP CoreRuleSet ModSecurity image fronting nginx, with a custom rule file for this app, blocking mode in production. HashiCorp Vault issues short-lived, dynamically-generated PostgreSQL credentials to both the Go auth service and the NestJS backend.
- **ORM (Minor)**: Prisma, used for every table in the schema.
- **Real-time collaborative features (Minor)**: live sync across Discovery, Kanban, the Evaluation Checklist, and project membership - a change made by one member appears for everyone else connected, without a page refresh.
- **Notification system (Minor)**: in-app notifications on assignment, removal, and completion events across tasks, calendar events, checklist progress, and project membership.
- **User activity analytics (Minor)**: the Summary dashboard, pulling live data from every other tab (task status, progress by category, team workload, upcoming events, defense readiness).
- **Support for additional browsers (Minor)**: confirmed working on Chrome, Brave, Firefox, and Zen Browser.
- **Advanced search (Minor)**: scoped cross-project search with filters, sorting, and pagination, available from the header on every page.

### Toward the bonus (in progress, temporary section)

| Module | Type | Pts | Working on it |
|---|---|---|---|
| Allow users to interact with other users (chat, profile, friends) | Web, Major | 2 | Christophe |

- **Allow users to interact with other users + Allow users to interact with other users (chat, profile, friends)**: group chat is done and merged; the friends/user-profile half of this module is still in progress, needed to validate the module as a whole.

The OAuth 2.0 provider flow and the email/password account model are already
implemented. Chat, friends, profiles, and extended search remain in progress.

## Individual Contributions

**Andrei** - Auth foundation (Argon2id, sessions), the JWT + refresh-token-family cutover, one-time WebSocket ticket admission, Vault-backed dynamic database credentials, realtime field locks, and project-bound public API tokens.

**Carlos** - Footer and legal pages, the project list and creation flow, the Kanban board's initial build, and (in progress) the workspace search bar.

**Christophe** - Initial frontend (TanStack Router) and backend (NestJS + Prisma) scaffolding, then the sidebar, RustFS-backed storage, avatar upload and user settings, the Evaluation Checklist, the friend system and the group chat.

**Diana** - Also part of the initial frontend/backend scaffolding, then shared layout fixes and Project Settings (member management, roles, project lifecycle).

**Pauline** - Also part of the initial frontend/backend scaffolding, landing page, project layout and Summary tab, Discovery tab, Calendar, the WebSocket layer and notification system, and the Kanban board's live-sync/notification follow-ups.

## Resources

### Documentation

- [React](https://react.dev/) / [TanStack Router](https://tanstack.com/router/latest)
- [NestJS](https://docs.nestjs.com/) / [Prisma](https://www.prisma.io/docs)
- [Socket.io](https://socket.io/docs/v4/)
- [Tailwind CSS](https://tailwindcss.com/docs) / [Flowbite React](https://flowbite-react.com/docs/getting-started/introduction)
- [HashiCorp Vault](https://developer.hashicorp.com/vault/docs)
- [Docker Compose](https://docs.docker.com/compose/)
- [JWT](https://datatracker.ietf.org/doc/html/rfc7519) / [refresh token rotation](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
- [Argon2 password hashing](https://argon2-cffi.readthedocs.io/en/stable/argon2.html)
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)

### AI usage

Claude + Copilot were used across the project to accelerate bootstrapping and scaffolding, as a Socratic tutor when learning a new concept or tool, to help track down bugs, and as a safety net during PR review. Used deliberately and reviewed by a team member, not as a substitute for understanding the code.
