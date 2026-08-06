# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Makefile                                           :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: fox <fox@student.42.fr>                    +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2026/06/18 18:04:43 by abelov            #+#    #+#              #
#    Updated: 2026/07/30 18:53:08 by fox              ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

# Auto-detect the compose CLI: prefer the Docker Compose v2 plugin, fall back to
# podman-compose on machines that only have that (e.g. podman + the podman-docker
# shim, which provides a `docker` command but no `docker compose` subcommand).
# Override explicitly if needed, e.g. `make COMPOSE=podman-compose up`.
ifndef COMPOSE
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "podman-compose")
endif
ENV_FILE = .env

# Deployment environments use separate Compose projects, external runtime
# environment files, and loopback-only ingress overrides. The secret files
# are intentionally not kept in the repository.
DEPLOY_SECRETS_DIR ?= /srv/transcendence
DEPLOY_DEV_ENV_FILE ?= $(DEPLOY_SECRETS_DIR)/development/secrets/runtime.env
DEPLOY_DEV_COMPOSE_FILE ?= ops/compose/development.yml
DEPLOY_DEV_PROJECT ?= transcendence-dev
DEPLOY_DEV_COMPOSE = $(COMPOSE) --project-name $(DEPLOY_DEV_PROJECT) \
	--env-file $(DEPLOY_DEV_ENV_FILE) -f docker-compose.yml -f $(DEPLOY_DEV_COMPOSE_FILE)

DEPLOY_PROD_ENV_FILE ?= $(DEPLOY_SECRETS_DIR)/production/secrets/runtime.env
DEPLOY_PROD_COMPOSE_FILE ?= ops/compose/production.yml
DEPLOY_PROD_PROJECT ?= transcendence-prod
DEPLOY_PROD_COMPOSE = $(COMPOSE) --project-name $(DEPLOY_PROD_PROJECT) \
	--env-file $(DEPLOY_PROD_ENV_FILE) -f docker-compose.yml -f $(DEPLOY_PROD_COMPOSE_FILE)

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

## overwrite .env with .env.example values and fresh random local secrets
recreate-env:
	sed \
		-e "s|^AUTH_INTERNAL_TOKEN=.*|AUTH_INTERNAL_TOKEN=$$(openssl rand -hex 32)|" \
		-e "s|^AUTH_REFRESH_SUCCESSOR_KEY=.*|AUTH_REFRESH_SUCCESSOR_KEY=$$(openssl rand -hex 32)|" \
		-e "s|^AUTH_PROJECT_API_TOKEN_PEPPER=.*|AUTH_PROJECT_API_TOKEN_PEPPER=$$(openssl rand -hex 32)|" \
		-e "s|^VAULT_DEV_ROOT_TOKEN=.*|VAULT_DEV_ROOT_TOKEN=$$(openssl rand -hex 32)|" \
		-e "s|^VAULT_DB_ADMIN_PASSWORD=.*|VAULT_DB_ADMIN_PASSWORD=$$(openssl rand -hex 32)|" \
		.env.example > $(ENV_FILE)


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

## build and start the isolated development deployment (requires runtime secrets)
deploy-dev:
	@test -f "$(DEPLOY_DEV_ENV_FILE)" || (echo "Missing development runtime env: $(DEPLOY_DEV_ENV_FILE)" >&2; exit 1)
	@test -f "$(DEPLOY_DEV_COMPOSE_FILE)" || (echo "Missing development Compose override: $(DEPLOY_DEV_COMPOSE_FILE)" >&2; exit 1)
	$(DEPLOY_DEV_COMPOSE) config --quiet
	$(DEPLOY_DEV_COMPOSE) up --build -d

## build and start the production deployment (requires runtime secrets)
deploy-prod:
	@test -f "$(DEPLOY_PROD_ENV_FILE)" || (echo "Missing production runtime env: $(DEPLOY_PROD_ENV_FILE)" >&2; exit 1)
	@test -f "$(DEPLOY_PROD_COMPOSE_FILE)" || (echo "Missing production Compose override: $(DEPLOY_PROD_COMPOSE_FILE)" >&2; exit 1)
	$(DEPLOY_PROD_COMPOSE) config --quiet
	$(DEPLOY_PROD_COMPOSE) up --build -d

## validate externally managed development runtime secrets without replacing them
recreate-env-dev:
	@test -f "$(DEPLOY_DEV_ENV_FILE)" || (echo "Missing development runtime env: $(DEPLOY_DEV_ENV_FILE)" >&2; exit 1)
	@test -f "$(DEPLOY_DEV_COMPOSE_FILE)" || (echo "Missing development Compose override: $(DEPLOY_DEV_COMPOSE_FILE)" >&2; exit 1)

## validate externally managed production runtime secrets without replacing them
recreate-env-prod:
	@test -f "$(DEPLOY_PROD_ENV_FILE)" || (echo "Missing production runtime env: $(DEPLOY_PROD_ENV_FILE)" >&2; exit 1)
	@test -f "$(DEPLOY_PROD_COMPOSE_FILE)" || (echo "Missing production Compose override: $(DEPLOY_PROD_COMPOSE_FILE)" >&2; exit 1)

## remove the isolated development deployment, volumes, orphans, and local images
fclean-dev:
	$(DEPLOY_DEV_COMPOSE) down --volumes --remove-orphans --rmi local

## remove the isolated production deployment, volumes, orphans, and local images
fclean-prod:
	$(DEPLOY_PROD_COMPOSE) down --volumes --remove-orphans --rmi local

## remove development build caches left by bind-mounted development containers
ffclean-dev:
	docker run --rm -v $(CURDIR)/frontend:/target -w /target alpine \
		sh -c "rm -rf node_modules dist build .vite .tanstack .flowbite-react .cache .eslintcache .stylelintcache coverage *.tsbuildinfo vite.config.js vite.config.d.ts"
	docker run --rm -v $(CURDIR)/backend:/target -w /target alpine \
		sh -c "rm -rf node_modules dist build .cache .eslintcache coverage *.tsbuildinfo"
	docker run --rm -v $(CURDIR)/auth:/target -w /target alpine \
		sh -c "rm -rf tmp .cache coverage.out"

## production containers do not bind mount source files, so no host cache cleanup is needed
ffclean-prod:
	@:

## remove the isolated development database volume and dependent containers
wipe-db-dev:
	$(DEPLOY_DEV_COMPOSE) stop nginx backend auth db
	for svc in nginx backend auth db; do \
	  ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(DEPLOY_DEV_PROJECT) --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q --filter label=com.docker.compose.project=$(DEPLOY_DEV_PROJECT) \
		--filter label=com.docker.compose.volume=db_data | xargs -r docker volume rm -f

## remove the isolated production database volume and dependent containers
wipe-db-prod:
	$(DEPLOY_PROD_COMPOSE) stop nginx backend auth db
	for svc in nginx backend auth db; do \
	  ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(DEPLOY_PROD_PROJECT) --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q --filter label=com.docker.compose.project=$(DEPLOY_PROD_PROJECT) \
		--filter label=com.docker.compose.volume=db_data | xargs -r docker volume rm -f

## remove the isolated development RustFS volume
wipe-storage-dev:
	$(DEPLOY_DEV_COMPOSE) stop rustfs
	ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(DEPLOY_DEV_PROJECT) --filter label=com.docker.compose.service=rustfs); \
	if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi
	docker volume ls -q --filter label=com.docker.compose.project=$(DEPLOY_DEV_PROJECT) \
		--filter label=com.docker.compose.volume=rustfs_data | xargs -r docker volume rm -f

## remove the isolated production RustFS volume
wipe-storage-prod:
	$(DEPLOY_PROD_COMPOSE) stop rustfs
	ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(DEPLOY_PROD_PROJECT) --filter label=com.docker.compose.service=rustfs); \
	if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi
	docker volume ls -q --filter label=com.docker.compose.project=$(DEPLOY_PROD_PROJECT) --filter label=com.docker.compose.volume=rustfs_data | xargs -r docker volume rm -f

## run migrations and runtime grants for the isolated development deployment
migrate-deploy-dev:
	$(DEPLOY_DEV_COMPOSE) --profile tools run --rm migration
	@set -a; . "$(DEPLOY_DEV_ENV_FILE)"; set +a; \
	$(DEPLOY_DEV_COMPOSE) exec -T db psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" < db/runtime-grants.sql

## run migrations and runtime grants for the isolated production deployment
migrate-deploy-prod:
	$(DEPLOY_PROD_COMPOSE) --profile tools run --rm migration
	@set -a; . "$(DEPLOY_PROD_ENV_FILE)"; set +a; \
	$(DEPLOY_PROD_COMPOSE) exec -T db psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" < db/runtime-grants.sql

## fully recreate the isolated development stack while preserving its runtime secrets
rere-dev:
	+$(MAKE) recreate-env-dev
	+$(MAKE) fclean-dev
	+$(MAKE) ffclean-dev
	+$(MAKE) wipe-db-dev
	+$(MAKE) wipe-storage-dev
	+$(MAKE) deploy-dev
	+$(MAKE) migrate-deploy-dev

## fully recreate the isolated production stack while preserving its runtime secrets
rere-prod:
	+$(MAKE) recreate-env-prod
	+$(MAKE) fclean-prod
	+$(MAKE) ffclean-prod
	+$(MAKE) wipe-db-prod
	+$(MAKE) wipe-storage-prod
	+$(MAKE) deploy-prod
	+$(MAKE) migrate-deploy-prod

## reinstall npm dependencies in running containers without rebuilding images
## use after pulling changes that add or remove npm dependencies (faster than up-build)
install:
	$(COMPOSE) exec frontend npm install
	$(COMPOSE) exec backend npm install

## stop the local development stack
down:
	$(COMPOSE) down

## restart the local stack through dependency-aware startup
restart:
	$(COMPOSE) stop
	$(COMPOSE) up -d

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

## show local Vault status (development mode only)
vault-status: $(ENV_FILE)
	$(COMPOSE) exec vault sh -c "VAULT_ADDR=http://127.0.0.1:8200 vault status"

## rebuild and start only the frontend service
rebuild-frontend: $(ENV_FILE)
	$(COMPOSE) up --build -d frontend

## rebuild and start only the backend service
rebuild-backend: $(ENV_FILE)
	$(COMPOSE) up --build -d backend

## refresh backend dependencies in its Compose-managed node_modules volume
install-backend: $(ENV_FILE)
	$(COMPOSE) run --rm --no-deps backend npm ci

## rebuild and start only the auth service
rebuild-auth: $(ENV_FILE)
	$(COMPOSE) up --build -d auth


# ---------------------------------------------------------------------------- #
# logs                                                                         #
# ---------------------------------------------------------------------------- #

## follow logs for all services
logs:
	$(COMPOSE) logs -f

## follow ingress nginx logs
logs-nginx:
	$(COMPOSE) logs -f nginx

## follow Nginx TLS Vault Agent logs
logs-nginx-tls-agent:
	$(COMPOSE) logs -f nginx-tls-agent

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

## follow rustfs logs
logs-rustfs:
	$(COMPOSE) logs -f rustfs


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
shell-db: $(ENV_FILE)
	@set -a; . ./$(ENV_FILE); set +a; \
	$(COMPOSE) exec db psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"

## open a shell in the rustfs container
shell-rustfs:
	$(COMPOSE) exec rustfs sh


# ---------------------------------------------------------------------------- #
# database                                                                     #
# ---------------------------------------------------------------------------- #

## run Prisma migrations with the short-lived Vault migration lease, then
## re-apply table-level grants for the Vault runtime parent roles
migrate: $(ENV_FILE)
	$(COMPOSE) --profile tools run --rm migration
	@set -a; . ./$(ENV_FILE); set +a; \
	$(COMPOSE) exec -T db psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" < db/runtime-grants.sql

## author a Prisma migration with the existing Vault migration lease (NAME is required)
migrate-dev: $(ENV_FILE)
	@test -n "$(NAME)" || (echo "Usage: make migrate-dev NAME=lowercase-migration-name" >&2; exit 1)
	$(COMPOSE) --profile tools run --rm --user "$$(id -u):$$(id -g)" -e PRISMA_MIGRATION_NAME="$(NAME)" \
		migration npx tsx scripts/vault-migrate-dev.ts

## restore host ownership after a migration authored by older tooling
migrate-fix-permissions: $(ENV_FILE)
	$(COMPOSE) --profile tools run --rm migration \
		chown -R "$$(id -u):$$(id -g)" /app/prisma/migrations

## start Prisma Studio from the backend container
prisma-studio:
	$(COMPOSE) exec backend npx prisma studio --browser none

## inject demo data using the short-lived Vault migration lease
seed:
	$(COMPOSE) --profile tools run --rm migration npx tsx scripts/vault-seed.ts

## inject demo data into the isolated development deployment
seed-dev:
	@test -f "$(DEPLOY_DEV_ENV_FILE)" || (echo "Missing development runtime env: $(DEPLOY_DEV_ENV_FILE)" >&2; exit 1)
	@test -f "$(DEPLOY_DEV_COMPOSE_FILE)" || (echo "Missing development Compose override: $(DEPLOY_DEV_COMPOSE_FILE)" >&2; exit 1)
	$(DEPLOY_DEV_COMPOSE) --profile tools run --rm migration npx tsx scripts/vault-seed.ts

## inject demo data into the production deployment
seed-prod:
	@test -f "$(DEPLOY_PROD_ENV_FILE)" || (echo "Missing production runtime env: $(DEPLOY_PROD_ENV_FILE)" >&2; exit 1)
	@test -f "$(DEPLOY_PROD_COMPOSE_FILE)" || (echo "Missing production Compose override: $(DEPLOY_PROD_COMPOSE_FILE)" >&2; exit 1)
	$(DEPLOY_PROD_COMPOSE) --profile tools run --rm migration npx tsx scripts/vault-seed.ts

## stop the database and remove its Compose-managed data volume
# same portable mechanism as ffclean: match containers/volumes by label or
# name suffix instead of `compose config --format json` / `compose rm`, which
# real docker compose supports but podman-compose does not (no `rm` subcommand
# at all, and `config` doesn't accept --format).
# backend and auth both have `depends_on: db`, and nginx depends on backend/auth
# in turn - podman refuses to remove db while those dependent containers are
# still around, so (like ffclean does for its own service set) they need to be
# stopped and removed too, not just db itself. This means `make up-db` alone
# is NOT enough afterwards (backend/auth/nginx are gone too, so `make migrate`
# / `make seed` would have no backend container to exec into) - bring the
# whole stack back with `make up` instead.
wipe-db: $(ENV_FILE)
	$(COMPOSE) stop nginx backend auth db
	for svc in nginx backend auth db; do \
	  ids=$$(docker ps -aq --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q | grep -E '_db_data$$' | xargs -r docker volume rm -f
	@echo "Database wiped. Run 'make up' (not just 'make up-db') then 'make migrate' to recreate it."

## stop RustFS and remove its Compose-managed data volume
# simpler than wipe-db: nothing in docker-compose.yml has depends_on: rustfs,
# so there's no dependent-container chain to stop/remove first - just rustfs
# itself. Same portable label-based removal as wipe-db/ffclean (works on both
# docker compose and podman-compose, unlike `compose rm`).
wipe-storage: $(ENV_FILE)
	$(COMPOSE) stop rustfs
	ids=$$(docker ps -aq --filter label=com.docker.compose.service=rustfs); \
	if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi
	docker volume ls -q | grep -E '_rustfs_data$$' | xargs -r docker volume rm -f
	@echo "RustFS storage wiped. Run 'make up' to recreate it - buckets are re-created lazily on the first upload."


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

## build the frontend application inside its Compose service
check-frontend:
	$(COMPOSE) exec frontend sh -c "npm run build && npm run test:auth-refresh"

## build the backend application inside its Compose service
check-backend:
	$(COMPOSE) exec backend sh -c "npm run build && npm run test:unit"

## validate the rendered ingress nginx configuration
check-nginx:
	$(COMPOSE) exec nginx nginx -t

## verify local HTTPS ingress, HSTS, and the HTTP-to-HTTPS redirect
check-tls:
	$(COMPOSE) exec nginx sh -c '! curl -ksSI --resolve localhost:8443:127.0.0.1 https://localhost:8443/ | grep -qi "^strict-transport-security:"'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve school.paris.42.school:8443:127.0.0.1 https://school.paris.42.school:8443/ | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve tomato.iops.dev:8443:127.0.0.1 https://tomato.iops.dev:8443/ | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve tomato-dev.iops.dev:8443:127.0.0.1 https://tomato-dev.iops.dev:8443/ | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -sSI -H "Host: localhost" http://127.0.0.1:8080/ | grep -qi "^location: https://localhost:8443/"'
	$(COMPOSE) exec nginx sh -c 'curl -sSI -H "Host: 127.0.0.1" http://127.0.0.1:8080/ | grep -qi "^location: https://localhost:8443/"'
	$(COMPOSE) exec nginx sh -c 'openssl s_client -connect 127.0.0.1:8443 -showcerts </dev/null 2>/dev/null | openssl x509 -noout -subject | grep -Eq "CN ?= ?localhost"'
	$(COMPOSE) exec nginx sh -c 'openssl s_client -connect 127.0.0.1:8443 -CAfile /etc/nginx/ssl/local.pem </dev/null 2>/dev/null | grep -F "Verify return code: 0 (ok)"'
	$(COMPOSE) exec nginx sh -c 'openssl s_client -connect 127.0.0.1:8443 -servername tomato.iops.dev -verify_hostname tomato.iops.dev -CAfile /etc/nginx/ssl/public-domains.pem </dev/null 2>/dev/null | grep -F "Verify return code: 0 (ok)"'
	$(COMPOSE) exec nginx sh -c 'openssl s_client -connect 127.0.0.1:8443 -servername tomato-dev.iops.dev -verify_hostname tomato-dev.iops.dev -CAfile /etc/nginx/ssl/public-domains.pem </dev/null 2>/dev/null | grep -F "Verify return code: 0 (ok)"'

## export the local development CA for one-time browser or OS trust installation
export-local-ca:
	mkdir -p .local
	$(COMPOSE) run --rm --no-deps -v "$(CURDIR)/.local:/export" vault-bootstrap \
		sh -c 'cp /run/pki-ca/root.crt /export/task-rabbit-local-ca.crt && chmod 0644 /export/task-rabbit-local-ca.crt'

## run Go tests and static analysis inside the auth Compose service
check-auth:
	$(COMPOSE) exec auth sh -c "go test ./... && go vet ./..."

## validate the Prisma schema inside the backend Compose service
check-prisma:
	$(COMPOSE) exec -e DATABASE_URL=postgresql://prisma-validation:prisma-validation@localhost:5432/prisma-validation backend npx prisma validate

## format Go authentication service sources
format-auth:
	$(COMPOSE) exec auth gofmt -w cmd internal

## validate the authentication integration services
check-auth-stack: check-auth check-prisma check-backend check-frontend

## verify one-use WebSocket admission, exact Origin, and sid revocation
check-websocket-e2e:
	$(COMPOSE) exec -e RUN_WEBSOCKET_E2E=1 frontend npm run test:websocket-e2e

## lint shell scripts (Vault bootstrap, db init, git hooks) with shellcheck
check-shell:
	docker run --rm -v $(CURDIR):/mnt -w /mnt koalaman/shellcheck:stable -s sh \
		vault/bootstrap.sh vault/check-policies.sh db/init/10-vault-db-admin-password.sh hooks/pre-commit

## verify local Vault AppRole policy isolation, Transit signing, and lease renewal
check-vault-policies: $(ENV_FILE)
	$(COMPOSE) --profile tests run --rm vault-test

## verify Vault-issued Prisma credential rotation, grants, and TR-69 migration safety
check-vault-prisma: $(ENV_FILE)
	$(COMPOSE) --profile tests run --rm backend-vault-test

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

## fully recreate the application stack, dependencies, and database
rere:
	+$(MAKE) recreate-env
	+$(MAKE) fclean
	+$(MAKE) ffclean
	+$(MAKE) wipe-db
	+$(MAKE) wipe-storage
	+$(MAKE) up-build
	+$(MAKE) migrate

## remove the named frontend/backend node_modules volumes and local build caches
ffclean:
	$(COMPOSE) stop nginx frontend backend auth
	for svc in nginx backend auth frontend; do \
	  ids=$$(docker ps -aq --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q | grep -E '_frontend_node_modules$$' | xargs -r docker volume rm -f
	docker volume ls -q | grep -E '_backend_node_modules$$' | xargs -r docker volume rm -f
	# dev containers run as root, so some generated files (e.g. dist/,
	# .flowbite-react/) can be root-owned on the host - clean them via a
	# throwaway root container instead of a plain host-side rm to avoid
	# "Permission denied"
	docker run --rm -v $(CURDIR)/frontend:/target -w /target alpine \
		sh -c "rm -rf node_modules dist build .vite .tanstack .flowbite-react .cache .eslintcache .stylelintcache coverage *.tsbuildinfo vite.config.js vite.config.d.ts"
	docker run --rm -v $(CURDIR)/backend:/target -w /target alpine \
		sh -c "rm -rf node_modules dist build .cache .eslintcache .stylelintcache coverage *.tsbuildinfo"
	docker run --rm -v $(CURDIR)/auth:/target -w /target alpine \
		sh -c "rm -rf tmp .cache coverage.out"
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

.PHONY: all up up-build deploy-dev deploy-prod rere-dev rere-prod down restart build logs ps clean fclean fclean-dev fclean-prod re rere ffclean ffclean-dev ffclean-prod rebuild \
        recreate-env recreate-env-dev recreate-env-prod wipe-db wipe-storage \
        wipe-db-dev wipe-db-prod wipe-storage-dev wipe-storage-prod migrate-deploy-dev migrate-deploy-prod \
        up-db up-frontend up-backend up-auth vault-status \
        rebuild-frontend rebuild-backend rebuild-auth \
        logs-nginx logs-nginx-tls-agent logs-frontend logs-backend logs-auth logs-db \
        shell-frontend shell-backend shell-auth shell-db \
        migrate migrate-dev migrate-fix-permissions prisma-studio install seed seed-dev seed-prod \
        format lint format-frontend lint-frontend format-backend lint-backend hooks \
        check-frontend check-backend check-nginx check-tls export-local-ca check-auth check-prisma format-auth check-auth-stack check-shell \
        check-vault-policies check-vault-prisma check-websocket-e2e
