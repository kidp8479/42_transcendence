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
# Override explicitly if needed, e.g. `make COMPOSE=podman-compose start`.
ifndef COMPOSE
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "podman-compose")
endif
COMPOSE_COMMAND := $(COMPOSE)

SCHOOL_PROJECT ?= transcendence-school
ENV_FILE ?= .env
SEED_FILE ?= .seed
SCHOOL_COMPOSE = $(COMPOSE_COMMAND) --project-name $(SCHOOL_PROJECT) \
	--env-file $(ENV_FILE) -f docker-compose.yml -f ops/compose/school.yml
override COMPOSE := $(SCHOOL_COMPOSE)

DEV_PROJECT ?= transcendence-dev
DEV_ENV_FILE ?= .env.local
DEV_SEED_FILE ?= .seed.local
DEV_COMPOSE = $(COMPOSE_COMMAND) --project-name $(DEV_PROJECT) \
	--env-file $(DEV_ENV_FILE) -f docker-compose.yml -f ops/compose/dev.yml

# ---------------------------------------------------------------------------- #
# default                                                                      #
# ---------------------------------------------------------------------------- #

## build and start the default school-evaluation stack
all: start

include deploy.mk


# ---------------------------------------------------------------------------- #
# env guard                                                                    #
# ---------------------------------------------------------------------------- #

$(ENV_FILE):
	@echo "Generating school runtime environment from .env.example."
	+$(MAKE) recreate-env

$(DEV_ENV_FILE):
	@echo "Generating local development runtime environment from .env.example."
	+$(MAKE) recreate-env-dev

## overwrite the school runtime environment with required school origins and fresh secrets
recreate-env:
	@env_file="$(ENV_FILE)"; \
	if test -f "$$env_file"; then \
		oauth_42_client_id_line="$$(grep -m 1 '^OAUTH_42_CLIENT_ID=' "$$env_file" || true)"; \
		oauth_42_client_secret_line="$$(grep -m 1 '^OAUTH_42_CLIENT_SECRET=' "$$env_file" || true)"; \
		oauth_google_client_id_line="$$(grep -m 1 '^OAUTH_GOOGLE_CLIENT_ID=' "$$env_file" || true)"; \
		oauth_google_client_secret_line="$$(grep -m 1 '^OAUTH_GOOGLE_CLIENT_SECRET=' "$$env_file" || true)"; \
		oauth_callback_origin_line="$$(grep -m 1 '^AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN=' "$$env_file" || true)"; \
	fi; \
	test -n "$$oauth_42_client_id_line" || oauth_42_client_id_line='OAUTH_42_CLIENT_ID='; \
	test -n "$$oauth_42_client_secret_line" || oauth_42_client_secret_line='OAUTH_42_CLIENT_SECRET='; \
	test -n "$$oauth_google_client_id_line" || oauth_google_client_id_line='OAUTH_GOOGLE_CLIENT_ID='; \
	test -n "$$oauth_google_client_secret_line" || oauth_google_client_secret_line='OAUTH_GOOGLE_CLIENT_SECRET='; \
	test -n "$$oauth_callback_origin_line" || oauth_callback_origin_line='AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN='; \
	umask 077; sed \
		-e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD='$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)'|" \
		-e "s|^AUTH_INTERNAL_TOKEN=.*|AUTH_INTERNAL_TOKEN=$$(openssl rand -hex 32)|" \
		-e "s|^AUTH_REFRESH_SUCCESSOR_KEY=.*|AUTH_REFRESH_SUCCESSOR_KEY=$$(openssl rand -hex 32)|" \
		-e "s|^AUTH_PROJECT_API_TOKEN_PEPPER=.*|AUTH_PROJECT_API_TOKEN_PEPPER=$$(openssl rand -hex 32)|" \
		-e "s|^SEED_PASSWORD=.*|SEED_PASSWORD='$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)'|" \
		-e "s|^VAULT_DEV_ROOT_TOKEN=.*|VAULT_DEV_ROOT_TOKEN=$$(openssl rand -hex 32)|" \
		-e "s|^VAULT_DB_ADMIN_PASSWORD=.*|VAULT_DB_ADMIN_PASSWORD='$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)'|" \
		-e "s|^APP_ORIGIN=.*|APP_ORIGIN=https://*.paris.42.school:8443|" \
		-e "s|^AUTH_JWT_ISSUER=.*|AUTH_JWT_ISSUER=https://*.paris.42.school:8443/auth|" \
		.env.example | grep -Ev '^(OAUTH_42_CLIENT_ID|OAUTH_42_CLIENT_SECRET|OAUTH_GOOGLE_CLIENT_ID|OAUTH_GOOGLE_CLIENT_SECRET|AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN)=' > "$$env_file.tmp"; \
	printf '\n%s\n%s\n%s\n%s\n%s\n' "$$oauth_42_client_id_line" "$$oauth_42_client_secret_line" "$$oauth_google_client_id_line" "$$oauth_google_client_secret_line" "$$oauth_callback_origin_line" >> "$$env_file.tmp"; \
	mv "$$env_file.tmp" "$$env_file"

## overwrite the local development runtime environment with fresh local secrets
recreate-env-dev:
	@umask 077; sed \
		-e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD='$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)'|" \
		-e "s|^AUTH_INTERNAL_TOKEN=.*|AUTH_INTERNAL_TOKEN=$$(openssl rand -hex 32)|" \
		-e "s|^AUTH_REFRESH_SUCCESSOR_KEY=.*|AUTH_REFRESH_SUCCESSOR_KEY=$$(openssl rand -hex 32)|" \
		-e "s|^AUTH_PROJECT_API_TOKEN_PEPPER=.*|AUTH_PROJECT_API_TOKEN_PEPPER=$$(openssl rand -hex 32)|" \
		-e "s|^SEED_PASSWORD=.*|SEED_PASSWORD='$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)'|" \
		-e "s|^VAULT_DEV_ROOT_TOKEN=.*|VAULT_DEV_ROOT_TOKEN=$$(openssl rand -hex 32)|" \
		-e "s|^VAULT_DB_ADMIN_PASSWORD=.*|VAULT_DB_ADMIN_PASSWORD='$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)'|" \
		.env.example > "$(DEV_ENV_FILE)"

## validate the school origin, issuer, and optional OAuth callback origin
validate-school-runtime: $(ENV_FILE)
	@set -a; . ./$(ENV_FILE); set +a; \
	test "$$NODE_ENV" = "development" || (echo "NODE_ENV must be development for school evaluation" >&2; exit 1); \
	test "$$APP_ORIGIN" = "https://*.paris.42.school:8443" || (echo "APP_ORIGIN must be https://*.paris.42.school:8443 for school evaluation" >&2; exit 1); \
	test "$$AUTH_JWT_ISSUER" = "https://*.paris.42.school:8443/auth" || (echo "AUTH_JWT_ISSUER must be https://*.paris.42.school:8443/auth for school evaluation" >&2; exit 1); \
	if [ -n "$$AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN" ] && ! printf '%s\n' "$$AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN" | grep -Eq '^https://[A-Za-z0-9-]+\.paris\.42\.school:8443$$'; then \
		echo "AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN must be an exact one-label school HTTPS origin on port 8443" >&2; \
		exit 1; \
	fi

# ---------------------------------------------------------------------------- #
# lifecycle                                                                    #
# ---------------------------------------------------------------------------- #

## start the default school-evaluation stack without forcing a rebuild
up: $(ENV_FILE) validate-school-runtime
	$(COMPOSE) up -d

## stop the default school-evaluation stack
down:
	$(COMPOSE) down

## rebuild images and start the default school-evaluation stack
## run this after pulling changes that add or remove npm dependencies
up-build: $(ENV_FILE) validate-school-runtime
	$(COMPOSE) up --build -d

## rebuild images and start the default school-evaluation stack
rebuild: up-build
start: up-build
	+$(MAKE) migrate
	+$(MAKE) seed

## build and start the explicit local development stack
start-dev: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) up --build -d
	+$(MAKE) migrate-dev
	+$(MAKE) seed-dev

## start the explicit local development stack without forcing a rebuild
up-dev: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) up -d

## stop the explicit local development stack
down-dev:
	$(DEV_COMPOSE) down

## restart the default school-evaluation stack through dependency-aware startup
restart:
	$(COMPOSE) stop
	$(COMPOSE) up -d

## rebuild all service images
build:
	$(COMPOSE) build

## rebuild all local development images
build-dev:
	$(DEV_COMPOSE) build

## reinstall local development npm dependencies without rebuilding images
install: install-dev

## reinstall local development npm dependencies without rebuilding images
install-dev:
	$(DEV_COMPOSE) exec frontend npm install
	$(DEV_COMPOSE) exec backend npm install

## refresh backend dependencies in its Compose-managed node_modules volume
install-backend: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) run --rm --no-deps backend npm ci

# ---------------------------------------------------------------------------- #
# individual services                                                          #
# ---------------------------------------------------------------------------- #

## start only the auth service without forcing a rebuild
up-auth:     $(ENV_FILE) ; $(COMPOSE) up -d auth

## start only the backend service without forcing a rebuild
up-backend:  $(ENV_FILE) ; $(COMPOSE) up -d backend

## start only the database service
up-db:       $(ENV_FILE) ; $(COMPOSE) up -d db

## start only the frontend service without forcing a rebuild
up-frontend: $(ENV_FILE) ; $(COMPOSE) up -d frontend

## start only the nginx service without forcing a rebuild
up-nginx:    $(ENV_FILE) ; $(COMPOSE) up -d nginx

## start only the rustfs service without forcing a rebuild
up-rustfs:   $(ENV_FILE) ; $(COMPOSE) up -d rustfs

## start only the Vault service without forcing a rebuild
up-vault:   $(ENV_FILE) ; $(COMPOSE) up -d vault


## show local Vault status (development mode only)
vault-status: $(ENV_FILE)
	$(COMPOSE) exec vault sh -c "VAULT_ADDR=http://127.0.0.1:8200 vault status"

## rebuild and start only the frontend service
rebuild-frontend: $(ENV_FILE)
	$(COMPOSE) up --build -d frontend

## rebuild and start only the local development frontend service
rebuild-frontend-dev: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) up --build -d frontend

## rebuild and start only the backend service
rebuild-backend: $(ENV_FILE)
	$(COMPOSE) up --build -d backend

## rebuild and start only the local development backend service
rebuild-backend-dev: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) up --build -d backend

## rebuild and start only the auth service
rebuild-auth: $(ENV_FILE)
	$(COMPOSE) up --build -d auth

## recreate the school auth service without rebuilding its image
recreate-auth: $(ENV_FILE)
	$(COMPOSE) up -d --force-recreate auth

## rebuild and start only the local development auth service
rebuild-auth-dev: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) up --build -d auth


# ---------------------------------------------------------------------------- #
# logs                                                                         #
# ---------------------------------------------------------------------------- #

## follow logs for all services
logs:
	$(COMPOSE) logs -f

## follow logs for all local development services
logs-dev:
	$(DEV_COMPOSE) logs -f

## follow ingress nginx logs
logs-nginx:
	$(COMPOSE) logs -f nginx

## follow local development ingress nginx logs
logs-nginx-dev:
	$(DEV_COMPOSE) logs -f nginx

## follow Nginx TLS Vault Agent logs
logs-nginx-tls-agent:
	$(COMPOSE) logs -f nginx-tls-agent

## follow frontend logs
logs-frontend:
	$(COMPOSE) logs -f frontend

## follow local development frontend logs
logs-frontend-dev:
	$(DEV_COMPOSE) logs -f frontend

## follow backend logs
logs-backend:
	$(COMPOSE) logs -f backend

## follow local development backend logs
logs-backend-dev:
	$(DEV_COMPOSE) logs -f backend

## follow auth service logs
logs-auth:
	$(COMPOSE) logs -f auth

## follow local development auth logs
logs-auth-dev:
	$(DEV_COMPOSE) logs -f auth

## follow database logs
logs-db:
	$(COMPOSE) logs -f db

## follow local development database logs
logs-db-dev:
	$(DEV_COMPOSE) logs -f db

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

## wait until the Nginx-routed backend health endpoint is available
wait-backend-health:
	@attempt=0; \
	until curl -fkfsS --max-time 2 https://localhost:8443/api/health >/dev/null; do \
		attempt=$$((attempt + 1)); \
		if [ "$$attempt" -ge 60 ]; then \
			echo "Timed out waiting for backend health;" >&2; exit 1; \
		fi; \
		sleep 1; \
	done

## run Prisma migrations with the short-lived Vault migration lease, then
## re-apply table-level grants for the Vault runtime parent roles
migrate: $(ENV_FILE) wait-backend-health
	$(COMPOSE) --profile tools run --rm migration
	@set -a; . ./$(ENV_FILE); set +a; \
	$(COMPOSE) exec -T db psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" < db/runtime-grants.sql

## run migrations and runtime grants in the local development environment
migrate-dev: $(DEV_ENV_FILE) wait-backend-health
	$(DEV_COMPOSE) --profile tools run --rm migration
	@set -a; . ./$(DEV_ENV_FILE); set +a; \
	$(DEV_COMPOSE) exec -T db psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" < db/runtime-grants.sql

## author a Prisma migration in the local development environment (NAME is required)
migrate-create-dev: $(DEV_ENV_FILE) wait-backend-health
	@test -n "$(NAME)" || (echo "Usage: make migrate-create-dev NAME=lowercase-migration-name" >&2; exit 1)
	$(DEV_COMPOSE) --profile tools run --rm --user "$$(id -u):$$(id -g)" -e PRISMA_MIGRATION_NAME="$(NAME)" \
		migration npx tsx scripts/vault-migrate-dev.ts

## restore host ownership after a migration authored by older tooling
migrate-fix-permissions: $(ENV_FILE)
	$(COMPOSE) --profile tools run --rm migration \
		chown -R "$$(id -u):$$(id -g)" /app/prisma/migrations

## start Prisma Studio from the backend container
prisma-studio:
	$(COMPOSE) exec backend npx prisma studio --browser none

## record successful demo-data injection for the default school environment
$(SEED_FILE):
	$(COMPOSE) --profile tools run --rm migration npx tsx scripts/vault-seed.ts
	@touch "$(SEED_FILE)"

## inject demo data once using the short-lived Vault migration lease
seed: $(ENV_FILE) $(SEED_FILE)

## record successful demo-data injection for the local development environment
$(DEV_SEED_FILE):
	$(DEV_COMPOSE) --profile tools run --rm migration npx tsx scripts/vault-seed.ts
	@touch "$(DEV_SEED_FILE)"

## inject demo data once into the local development environment
seed-dev: $(DEV_ENV_FILE) $(DEV_SEED_FILE)

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
	  ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(SCHOOL_PROJECT) --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q --filter label=com.docker.compose.project=$(SCHOOL_PROJECT) \
		--filter label=com.docker.compose.volume=db_data | xargs -r docker volume rm -f
	rm -f "$(SEED_FILE)"
	@echo "Database wiped. Run 'make up' (not just 'make up-db') then 'make migrate' to recreate it."

## stop the local development database and remove its Compose-managed data volume
wipe-db-dev: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) stop nginx backend auth db
	for svc in nginx backend auth db; do \
	  ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(DEV_PROJECT) --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q --filter label=com.docker.compose.project=$(DEV_PROJECT) \
		--filter label=com.docker.compose.volume=db_data | xargs -r docker volume rm -f
	rm -f "$(DEV_SEED_FILE)"
	@echo "Database wiped. Run 'make up-dev' then 'make migrate-dev' to recreate it."

## stop RustFS and remove its Compose-managed data volume
# simpler than wipe-db: nothing in docker-compose.yml has depends_on: rustfs,
# so there's no dependent-container chain to stop/remove first - just rustfs
# itself. Same portable label-based removal as wipe-db/ffclean (works on both
# docker compose and podman-compose, unlike `compose rm`).
wipe-storage: $(ENV_FILE)
	$(COMPOSE) stop rustfs
	ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(SCHOOL_PROJECT) --filter label=com.docker.compose.service=rustfs); \
	if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi
	docker volume ls -q --filter label=com.docker.compose.project=$(SCHOOL_PROJECT) \
		--filter label=com.docker.compose.volume=rustfs_data | xargs -r docker volume rm -f
	@echo "RustFS storage wiped. Run 'make up' to recreate it - buckets are re-created lazily on the first upload."

## stop local development RustFS and remove its Compose-managed data volume
wipe-storage-dev: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) stop rustfs
	ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(DEV_PROJECT) --filter label=com.docker.compose.service=rustfs); \
	if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi
	docker volume ls -q --filter label=com.docker.compose.project=$(DEV_PROJECT) \
		--filter label=com.docker.compose.volume=rustfs_data | xargs -r docker volume rm -f
	@echo "RustFS storage wiped. Run 'make up-dev' to recreate it - buckets are re-created lazily on the first upload."


# ---------------------------------------------------------------------------- #
# code quality                                                                 #
# ---------------------------------------------------------------------------- #

## format frontend and backend
format: format-frontend format-backend format-auth

## lint frontend and backend
lint: lint-frontend lint-backend

## format Go authentication service sources
format-auth:
	$(DEV_COMPOSE) exec -T auth gofmt -w cmd internal

## format all frontend files with Prettier
format-frontend:
	$(DEV_COMPOSE) exec -T frontend npm run format

## run ESLint on all frontend files
lint-frontend:
	$(DEV_COMPOSE) exec -T frontend npm run lint

## format all backend files with Prettier
format-backend:
	$(DEV_COMPOSE) exec -T backend npm run format

## run ESLint on all backend files
lint-backend:
	$(DEV_COMPOSE) exec -T backend npm run lint

## build the frontend application inside its Compose service
check-frontend:
	$(DEV_COMPOSE) exec frontend sh -c "npm run build && npm run test:auth-refresh"

## build the backend application inside its Compose service
check-backend:
	$(DEV_COMPOSE) exec backend sh -c "npm run build && npm run test:unit"

## validate the rendered ingress nginx configuration
check-nginx:
	$(COMPOSE) exec nginx nginx -t

## verify static Nginx error pages and preserved API/Auth JSON errors
check-nginx-error-pages: check-nginx
	COMPOSE="$(COMPOSE)" nginx/check-error-pages.sh

## verify the static Nginx status page and its readiness probes
check-status-page: check-nginx
	COMPOSE="$(COMPOSE)" nginx/check-status-page.sh

## verify local HTTPS ingress, HSTS, and the HTTP-to-HTTPS redirect
check-tls:
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve localhost:8443:127.0.0.1 https://localhost:8443/ -o /tmp/hsts-root-headers && ! grep -qi "^strict-transport-security:" /tmp/hsts-root-headers'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve localhost:8443:127.0.0.1 https://localhost:8443/status -o /tmp/hsts-status-headers && ! grep -qi "^strict-transport-security:" /tmp/hsts-status-headers'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve school.paris.42.school:8443:127.0.0.1 https://school.paris.42.school:8443/ | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve tomato.iops.dev:8443:127.0.0.1 https://tomato.iops.dev:8443/ | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve tomato-dev.iops.dev:8443:127.0.0.1 https://tomato-dev.iops.dev:8443/ | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve school.paris.42.school:8443:127.0.0.1 https://school.paris.42.school:8443/status | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve tomato.iops.dev:8443:127.0.0.1 https://tomato.iops.dev:8443/status | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -ksSI --resolve tomato-dev.iops.dev:8443:127.0.0.1 https://tomato-dev.iops.dev:8443/status | grep -qi "^strict-transport-security: max-age=31536000; includesubdomains"'
	$(COMPOSE) exec nginx sh -c 'curl -sSI -H "Host: localhost" http://127.0.0.1:8080/ | grep -qi "^location: https://localhost:8443/"'
	$(COMPOSE) exec nginx sh -c 'curl -sSI -H "Host: 127.0.0.1" http://127.0.0.1:8080/ | grep -qi "^location: https://localhost:8443/"'
	$(COMPOSE) exec nginx sh -c 'openssl s_client -connect 127.0.0.1:8443 -showcerts </dev/null 2>/dev/null | openssl x509 -noout -subject | grep -Eq "CN ?= ?localhost"'
	$(COMPOSE) exec nginx sh -c 'openssl s_client -connect 127.0.0.1:8443 -CAfile /etc/nginx/ssl/local.pem </dev/null 2>/dev/null | grep -F "Verify return code: 0 (ok)"'
	$(COMPOSE) exec nginx sh -c 'openssl s_client -connect 127.0.0.1:8443 -servername tomato.iops.dev -verify_hostname tomato.iops.dev -CAfile /etc/nginx/ssl/public-domains.pem </dev/null 2>/dev/null | grep -F "Verify return code: 0 (ok)"'
	$(COMPOSE) exec nginx sh -c 'openssl s_client -connect 127.0.0.1:8443 -servername tomato-dev.iops.dev -verify_hostname tomato-dev.iops.dev -CAfile /etc/nginx/ssl/public-domains.pem </dev/null 2>/dev/null | grep -F "Verify return code: 0 (ok)"'

## export the local development CA for one-time browser or OS trust installation
export-local-ca:
	mkdir -p .local
	$(DEV_COMPOSE) run --rm --no-deps -v "$(CURDIR)/.local:/export" vault-bootstrap \
		sh -c 'cp /run/pki-ca/root.crt /export/task-rabbit-local-ca.crt && chmod 0644 /export/task-rabbit-local-ca.crt'

## run Go tests and static analysis inside the auth Compose service
check-auth:
	$(DEV_COMPOSE) exec auth sh -c "go test ./... && go vet ./..."

## validate the Prisma schema inside the backend Compose service
check-prisma: COMPOSE = $(DEV_COMPOSE)
check-prisma:
	$(COMPOSE) exec -e DATABASE_URL=postgresql://prisma-validation:prisma-validation@localhost:5432/prisma-validation backend npx prisma validate

## validate the authentication integration services
check-auth-stack: check-auth check-prisma check-backend check-frontend

## verify one-use WebSocket admission, exact Origin, and sid revocation
check-websocket-e2e:
	@set -e; \
	vault_token="$$(sed -n 's/^VAULT_DEV_ROOT_TOKEN=//p' $(DEV_ENV_FILE))"; \
	seed_password="$$($(DEV_COMPOSE) exec -T -e VAULT_TOKEN="$$vault_token" vault sh -c 'VAULT_ADDR=http://127.0.0.1:8200 vault kv get -field=password kv/seed/demo-users')"; \
	$(DEV_COMPOSE) exec \
		-e RUN_WEBSOCKET_E2E=1 \
		-e WEBSOCKET_E2E_URL=https://nginx:8443 \
		-e WEBSOCKET_E2E_ORIGIN=https://localhost:8443 \
		-e WEBSOCKET_E2E_INGRESS_HOST=localhost \
		-e WEBSOCKET_E2E_TLS_SERVER_NAME=localhost \
		-e WEBSOCKET_E2E_PASSWORD="$$seed_password" \
		frontend npm run test:websocket-e2e

## lint shell scripts (Vault bootstrap, db init, git hooks) with shellcheck
check-shell:
	docker run --rm -v $(CURDIR):/mnt -w /mnt docker.io/koalaman/shellcheck:stable -s sh \
		vault/bootstrap.sh vault/check-policies.sh db/init/10-vault-db-admin-password.sh \
		hooks/pre-commit nginx/check-error-pages.sh nginx/check-status-page.sh

## verify local Vault AppRole policy isolation, Transit signing, and lease renewal
check-vault-policies: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) --profile tests run --rm vault-test

## verify Vault-issued Prisma credential rotation, grants, and TR-69 migration safety
check-vault-prisma: $(DEV_ENV_FILE)
	$(DEV_COMPOSE) --profile tests run --rm backend-vault-test

## install git pre-commit hook (run once after cloning)
hooks:
	@hook_path="$$(git rev-parse --git-path hooks/pre-commit)"; \
	cp hooks/pre-commit "$$hook_path"; \
	chmod +x "$$hook_path"
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

## stop and remove containers on the system and remove orphans
nuke:
	docker ps -qa | xargs -r docker stop
	@containers="$$(docker ps -qa)"; \
	while [ -n "$$containers" ]; do \
		before_count="$$(printf '%s\n' "$$containers" | wc -w)"; \
		for container in $$containers; do docker rm -f "$$container" >/dev/null 2>&1 || true; done; \
		containers="$$(docker ps -qa)"; \
		after_count="$$(printf '%s\n' "$$containers" | wc -w)"; \
		if [ "$$after_count" -ge "$$before_count" ]; then \
			echo "Unable to remove all containers; remaining containers may have external dependencies:" >&2; \
			printf '%s\n' "$$containers" >&2; \
			exit 1; \
		fi; \
	done
	docker images -qa | xargs -r docker rmi -f
	docker volume ls -q | xargs -r docker volume rm
	docker network prune -f
	docker system prune -af
	docker volume prune -f

## stop containers and remove orphans
clean:
	$(COMPOSE) down --remove-orphans

## remove containers, volumes, orphans, and local images
fclean:
	$(COMPOSE) down --volumes --remove-orphans --rmi local # preserves pulled external images with explicit tags
	rm -f "$(SEED_FILE)"

## remove local development containers, volumes, orphans, and local images
fclean-dev:
	$(DEV_COMPOSE) down --volumes --remove-orphans --rmi local # preserves pulled external images with explicit tags
	rm -f "$(DEV_SEED_FILE)"

## fully reset, migrate, and seed the default school-evaluation stack
re: $(ENV_FILE) fclean
	+$(MAKE) start

## fully recreate the default school-evaluation stack
rere:
	+$(MAKE) recreate-env
	+$(MAKE) fclean
	+$(MAKE) start

## fully reset, migrate, and seed the local development stack
re-dev: $(DEV_ENV_FILE) fclean-dev
	+$(MAKE) start-dev

## fully recreate the local development stack, dependencies, and database
rere-dev:
	+$(MAKE) recreate-env-dev
	+$(MAKE) fclean-dev
	+$(MAKE) clean-dev-artifacts
	+$(MAKE) start-dev

## remove local development node_modules volumes and host build caches
ffclean-dev:
	$(DEV_COMPOSE) stop nginx frontend backend auth
	for svc in nginx backend auth frontend; do \
	  ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(DEV_PROJECT) --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q --filter label=com.docker.compose.project=$(DEV_PROJECT) \
		--filter label=com.docker.compose.volume=frontend_node_modules | xargs -r docker volume rm -f
	docker volume ls -q --filter label=com.docker.compose.project=$(DEV_PROJECT) \
		--filter label=com.docker.compose.volume=backend_node_modules | xargs -r docker volume rm -f
	+$(MAKE) clean-dev-artifacts

## remove host build caches produced by local development containers
clean-dev-artifacts:
	# dev containers run as root, so some generated files (e.g. dist/,
	# .flowbite-react/) can be root-owned on the host - clean them via a
	# throwaway root container instead of a plain host-side rm to avoid
	# "Permission denied"
	docker run --rm -v $(CURDIR)/frontend:/target -w /target docker.io/library/alpine \
		sh -c "rm -rf node_modules dist build .vite .tanstack .flowbite-react .cache .eslintcache .stylelintcache coverage *.tsbuildinfo vite.config.js vite.config.d.ts"
	docker run --rm -v $(CURDIR)/backend:/target -w /target docker.io/library/alpine \
		sh -c "rm -rf node_modules dist build .cache .eslintcache .stylelintcache coverage *.tsbuildinfo"
	docker run --rm -v $(CURDIR)/auth:/target -w /target docker.io/library/alpine \
		sh -c "rm -rf tmp .cache coverage.out"
	@echo "Local caches and node_modules volumes cleaned. Run 'make start-dev' next."


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

.PHONY: all up up-build start rebuild down restart build logs ps nuke clean fclean re rere \
        up-dev start-dev down-dev build-dev fclean-dev re-dev rere-dev ffclean-dev clean-dev-artifacts \
        recreate-env recreate-env-dev wipe-db wipe-storage wipe-db-dev wipe-storage-dev \
        up-db up-frontend up-backend up-auth up-nginx up-rustfs up-vault vault-status \
        rebuild-frontend rebuild-backend rebuild-auth recreate-auth rebuild-frontend-dev rebuild-backend-dev rebuild-auth-dev \
        logs-dev logs-nginx logs-nginx-dev logs-nginx-tls-agent logs-frontend logs-frontend-dev logs-backend logs-backend-dev logs-auth logs-auth-dev logs-db logs-db-dev \
        shell-frontend shell-backend shell-auth shell-db \
        wait-backend-health migrate migrate-dev migrate-create-dev migrate-fix-permissions prisma-studio install install-dev install-backend seed seed-dev \
        format lint format-frontend lint-frontend format-backend lint-backend hooks \
        check-frontend check-backend check-nginx check-tls export-local-ca check-auth check-prisma format-auth check-auth-stack check-shell \
        check-vault-policies check-vault-prisma check-websocket-e2e \
        start-test start-prod
