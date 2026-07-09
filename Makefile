# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Makefile                                           :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: abelov <abelov@student.42london.com>       +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2026/06/18 18:04:43 by abelov            #+#    #+#              #
#    Updated: 2026/06/18 18:04:43 by abelov           ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

# Auto-detect the compose CLI: prefer the Docker Compose v2 plugin, fall back to
# podman-compose on machines that only have that (e.g. podman + the podman-docker
# shim, which provides a `docker` command but no `docker compose` subcommand).
# Override explicitly if needed, e.g. `make COMPOSE=podman-compose up`.
ifndef COMPOSE
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "podman-compose")
endif

# Layer in docker-compose.podman.yml (sets userns_mode: keep-id, needed for
# correct bind-mount permissions under rootless Podman - see that file for why)
# whenever Podman is present, regardless of which compose command got picked
# above. This can't be inferred from the `docker compose version` check alone:
# some Podman setups install a "docker" shim (podman-docker) whose `docker
# compose` subcommand transparently forwards to podman-compose, so that check
# succeeds and reports "docker compose" even though Podman is what's actually
# running underneath.
ifeq ($(shell command -v podman >/dev/null 2>&1 && echo yes),yes)
COMPOSE := $(COMPOSE) -f docker-compose.yml -f docker-compose.podman.yml
endif
ENV_FILE = .env

# ---------------------------------------------------------------------------- #
# default                                                                      #
# ---------------------------------------------------------------------------- #

## start the default local development stack
all: up


# ---------------------------------------------------------------------------- #
# env guard                                                                    #
# ---------------------------------------------------------------------------- #

$(ENV_FILE):
	@echo "No .env found. Copying .env.example.."
	cp .env.example $(ENV_FILE)


# ---------------------------------------------------------------------------- #
# lifecycle                                                                    #
# ---------------------------------------------------------------------------- #

## start the local development stack without forcing a rebuild
up: $(ENV_FILE)
	$(COMPOSE) up -d

## rebuild images and start the local development stack
## run this after pulling changes that add or remove npm dependencies
up-build: $(ENV_FILE)
	$(COMPOSE) up --build -d

## reinstall npm dependencies in running containers without rebuilding images
## use after pulling changes that add or remove npm dependencies (faster than up-build)
install:
	$(COMPOSE) exec frontend npm install
	$(COMPOSE) exec backend npm install

## stop the local development stack
down:
	$(COMPOSE) down

## restart running containers
restart:
	$(COMPOSE) restart

## rebuild all service images
build:
	$(COMPOSE) build


# ---------------------------------------------------------------------------- #
# individual services                                                          #
# ---------------------------------------------------------------------------- #

## start only the database service
up-db:       $(ENV_FILE) ; $(COMPOSE) up -d db

## start only the frontend service without forcing a rebuild
up-frontend: $(ENV_FILE) ; $(COMPOSE) up -d frontend

## start only the backend service without forcing a rebuild
up-backend:  $(ENV_FILE) ; $(COMPOSE) up -d backend

## start only the auth service without forcing a rebuild
up-auth:     $(ENV_FILE) ; $(COMPOSE) up -d auth

## rebuild and start only the frontend service
rebuild-frontend: $(ENV_FILE)
	$(COMPOSE) up --build -d frontend

## rebuild and start only the backend service
rebuild-backend: $(ENV_FILE)
	$(COMPOSE) up --build -d backend

## rebuild and start only the auth service
rebuild-auth: $(ENV_FILE)
	$(COMPOSE) up --build -d auth


# ---------------------------------------------------------------------------- #
# logs                                                                         #
# ---------------------------------------------------------------------------- #

## follow logs for all services
logs:
	$(COMPOSE) logs -f

## follow frontend logs
logs-frontend:
	$(COMPOSE) logs -f frontend

## follow backend logs
logs-backend:
	$(COMPOSE) logs -f backend

## follow auth service logs
logs-auth:
	$(COMPOSE) logs -f auth

## follow database logs
logs-db:
	$(COMPOSE) logs -f db


# ---------------------------------------------------------------------------- #
# shells                                                                       #
# ---------------------------------------------------------------------------- #

## open a shell in the frontend container
shell-frontend:
	$(COMPOSE) exec frontend sh

## open a shell in the backend container
shell-backend:
	$(COMPOSE) exec backend sh

## open a shell in the auth container
shell-auth:
	$(COMPOSE) exec auth sh

## open psql in the database container
shell-db:
	$(COMPOSE) exec db psql -U $${POSTGRES_USER} $${POSTGRES_DB}


# ---------------------------------------------------------------------------- #
# database                                                                     #
# ---------------------------------------------------------------------------- #

## run Prisma migrations in the backend container
migrate:
	$(COMPOSE) exec backend npx prisma migrate dev

## start Prisma Studio from the backend container
prisma-studio:
	$(COMPOSE) exec backend npx prisma studio --browser none

## inject demo data into the database (run once after migrate, requires seed.ts to be implemented)
seed:
	$(COMPOSE) exec backend npx prisma db seed


# ---------------------------------------------------------------------------- #
# code quality                                                                 #
# ---------------------------------------------------------------------------- #

## format frontend and backend
format: format-frontend format-backend

## lint frontend and backend
lint: lint-frontend lint-backend

## format all frontend files with Prettier
format-frontend:
	$(COMPOSE) exec frontend npm run format

## run ESLint on all frontend files
lint-frontend:
	$(COMPOSE) exec frontend npm run lint

## format all backend files with Prettier
format-backend:
	$(COMPOSE) exec backend npm run format

## run ESLint on all backend files
lint-backend:
	$(COMPOSE) exec backend npm run lint

## install git pre-commit hook (run once after cloning)
hooks:
	cp hooks/pre-commit .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit
	@echo "pre-commit hook installed"


# ---------------------------------------------------------------------------- #
# status                                                                       #
# ---------------------------------------------------------------------------- #

## show container status
ps:
	$(COMPOSE) ps


# ---------------------------------------------------------------------------- #
# cleanup                                                                      #
# ---------------------------------------------------------------------------- #

## stop containers and remove orphans
clean:
	$(COMPOSE) down --remove-orphans

## remove containers, volumes, orphans, and local images
fclean:
	$(COMPOSE) down --volumes --remove-orphans --rmi local

## fully reset and start the local development stack
re: fclean
	+$(MAKE) up

## remove the named frontend/backend node_modules volumes and local build caches
ffclean:
	$(COMPOSE) stop nginx frontend backend auth
	for svc in nginx backend auth frontend; do \
	  ids=$$(docker ps -aq --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q | grep -E '_frontend_node_modules$$' | xargs -r docker volume rm -f
	docker volume ls -q | grep -E '_backend_node_modules$$' | xargs -r docker volume rm -f
	rm -rf frontend/node_modules frontend/dist frontend/build frontend/.vite \
	       frontend/.tanstack frontend/.flowbite-react frontend/.cache \
	       frontend/.eslintcache frontend/.stylelintcache frontend/coverage \
	       frontend/*.tsbuildinfo
	rm -rf backend/node_modules backend/dist backend/build backend/.cache \
	       backend/.eslintcache backend/.stylelintcache backend/coverage \
	       backend/*.tsbuildinfo
	rm -rf auth/tmp auth/.cache auth/coverage.out
	@echo "Local caches and node_modules volumes cleaned. Run 'make up-build' next."

## rebuild images and start the local development stack
rebuild: up-build

# Magic help adapted: from https://gitlab.com/depressiveRobot/make-help/blob/master/help.mk (MIT License)
help:
	@printf "\nAvailable targets:\n\n"
	@awk -F: '/^[a-zA-Z\-_0-9%\\ ]+:/ { \
			helpMessage = match(lastLine, /^## (.*)/); \
			if (helpMessage) { \
					helpCommand = $$1; \
					helpMessage = substr(lastLine, RSTART + 3, RLENGTH); \
					printf "  \x1b[32;01m%-35s\x1b[0m %s\n", helpCommand, helpMessage; \
			} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST) | sort -u
	@printf "\n"

.PHONY: all up up-build down restart build logs ps clean fclean re ffclean rebuild \
        up-db up-frontend up-backend up-auth \
        rebuild-frontend rebuild-backend rebuild-auth \
        logs-frontend logs-backend logs-auth logs-db \
        shell-frontend shell-backend shell-auth shell-db \
        migrate prisma-studio install seed \
        format lint format-frontend lint-frontend format-backend lint-backend hooks
