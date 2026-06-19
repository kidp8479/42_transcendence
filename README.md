*This project has been created as part of the 42 curriculum by cade-jes, cgajean, diade-so, pafroidu, abelov.*

## Description

## Instructions

### Local development

#### Prerequisites

- Docker with Docker Compose v2
- `make`

The project is designed to run locally in Docker. The development stack starts:

- `nginx` as the local entrypoint on [http://localhost](http://localhost)
- `frontend` as a React/Vite dev server
- `backend` as a NestJS dev server
- `auth` as a Go service with hot reload via Air
- `db` as PostgreSQL 16

#### Quick start

From the repository root:

```sh
make up
```

On the first run, the Makefile copies `.env.example` to `.env` automatically if `.env` does not already exist. If the Docker images do not exist yet, Docker Compose builds them. After that, `make up` starts the existing development containers without forcing a rebuild.

When the containers are running, open the website in your browser at [http://localhost](http://localhost).

You do not need to open the frontend container port directly. Docker Compose only publishes nginx on local port `8080`, and nginx forwards requests to the right service inside Docker.

Local routes:

- Frontend: [http://localhost/](http://localhost/)
- Backend API: [http://localhost/api](http://localhost/api)
- Backend WebSocket: [ws://localhost/ws](ws://localhost/ws)
- Auth service: [http://localhost/auth](http://localhost/auth)

If [http://localhost](http://localhost) does not load, check that the stack is running:

```sh
make ps
make logs
```

If nginx cannot start because port `8080` is already in use, stop the other local service using that port, then run `make up` again.

#### Daily development flow

Use Docker Compose as the canonical local stack:

```sh
make up
```

The frontend, backend, and auth services mount the local source folders into their containers, so normal source edits should hot reload without rebuilding Docker images.

Use the service logs while developing:

```sh
make logs-frontend
make logs-backend
make logs-auth
```

Only rebuild when dependencies, Dockerfiles, or container setup changed:

```sh
make up-build          # rebuild and start the full stack
make rebuild-frontend  # rebuild only the frontend service
make rebuild-backend   # rebuild only the backend service
make rebuild-auth      # rebuild only the auth service
```

`make re` is a full reset. It removes local containers, local images, and Docker volumes before starting again. Use it when you intentionally want a clean rebuild, not for everyday development.

#### Optional fast frontend-only loop

For UI-only work, you can run Vite directly on the host for faster visual feedback:

```sh
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

This is only a frontend convenience loop. The canonical full application still runs through `make up` and [http://localhost](http://localhost). If the frontend needs the API or WebSocket routes, keep the Docker stack running as well so `VITE_API_URL=http://localhost/api` and `VITE_WS_URL=ws://localhost/ws` have services to reach.

#### Environment variables

Default local values live in `.env.example`. For normal local development, the generated `.env` works as-is for database and internal service wiring.

If you need OAuth login during development, fill in the provider credentials in `.env`:

```sh
OAUTH_42_CLIENT_ID=
OAUTH_42_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
```

Keep these values private and do not commit `.env`.

#### Useful commands

```sh
make up              # start the full development stack
make up-build        # rebuild and start the full development stack
make down            # stop the stack
make restart         # restart running containers
make build           # rebuild images
make ps              # show container status
make logs            # follow logs for all services
make logs-frontend   # follow frontend logs
make logs-backend    # follow backend logs
make logs-auth       # follow auth service logs
make logs-db         # follow database logs
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

Open Prisma Studio without launching a browser in the container:

```sh
make prisma-studio
```

#### Cleanup

```sh
make clean    # stop containers and remove orphans
make fclean   # also remove volumes and local images
make re       # full clean rebuild
```

Use `make fclean` with care: it removes the PostgreSQL Docker volume, so local database data will be deleted.

## Team Information

## Project Management

## Technical Stack

## Database Schema

## Features List

## Modules

## Individual Contributions

## Resources
