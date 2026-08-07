# Environment-specific deployment lifecycle targets. The root Makefile retains
# local development targets; this file owns the isolated VM, school, and VPS
# profiles.

DEPLOY_SECRETS_DIR ?= /srv/transcendence
DEPLOYMENTS := dev school prod

DEPLOY_DEV_ENV_FILE ?= $(DEPLOY_SECRETS_DIR)/development/secrets/runtime.env
DEPLOY_DEV_COMPOSE_FILE ?= ops/compose/development.yml
DEPLOY_DEV_PROJECT ?= transcendence-dev

DEPLOY_SCHOOL_ENV_FILE ?= $(if $(filter $(DEPLOY_SECRETS_DIR)/school/%,$(abspath $(CURDIR))),$(DEPLOY_SECRETS_DIR)/school/secrets/runtime.env,.env.school)
DEPLOY_SCHOOL_COMPOSE_FILE ?= ops/compose/school.yml
DEPLOY_SCHOOL_PROJECT ?= transcendence-school

DEPLOY_PROD_ENV_FILE ?= $(DEPLOY_SECRETS_DIR)/production/secrets/runtime.env
DEPLOY_PROD_COMPOSE_FILE ?= ops/compose/production.yml
DEPLOY_PROD_PROJECT ?= transcendence-prod

DEPLOY_dev_NAME := development
DEPLOY_dev_ENV_FILE = $(DEPLOY_DEV_ENV_FILE)
DEPLOY_dev_COMPOSE_FILE = $(DEPLOY_DEV_COMPOSE_FILE)
DEPLOY_dev_PROJECT = $(DEPLOY_DEV_PROJECT)
DEPLOY_dev_SOURCE_MOUNTS := false

DEPLOY_school_NAME := school
DEPLOY_school_ENV_FILE = $(DEPLOY_SCHOOL_ENV_FILE)
DEPLOY_school_COMPOSE_FILE = $(DEPLOY_SCHOOL_COMPOSE_FILE)
DEPLOY_school_PROJECT = $(DEPLOY_SCHOOL_PROJECT)
DEPLOY_school_SOURCE_MOUNTS := false

DEPLOY_prod_NAME := production
DEPLOY_prod_ENV_FILE = $(DEPLOY_PROD_ENV_FILE)
DEPLOY_prod_COMPOSE_FILE = $(DEPLOY_PROD_COMPOSE_FILE)
DEPLOY_prod_PROJECT = $(DEPLOY_PROD_PROJECT)
DEPLOY_prod_SOURCE_MOUNTS := false

deployment_value = $(DEPLOY_$(1)_$(2))
deployment_name = $(call deployment_value,$(1),NAME)
deployment_env_file = $(call deployment_value,$(1),ENV_FILE)
deployment_compose_file = $(call deployment_value,$(1),COMPOSE_FILE)
deployment_project = $(call deployment_value,$(1),PROJECT)
deployment_source_mounts = $(call deployment_value,$(1),SOURCE_MOUNTS)
deployment_compose = $(COMPOSE) --project-name $(call deployment_project,$(1)) \
	--env-file $(call deployment_env_file,$(1)) -f docker-compose.yml \
	-f $(call deployment_compose_file,$(1))

## build and start an isolated deployment (requires its runtime environment)
deploy-%: validate-deployment-%
	$(call deployment_compose,$*) config --quiet
	$(call deployment_compose,$*) up --build -d

## validate an externally managed deployment runtime environment without replacing it
recreate-env-%: validate-deployment-%
	@:

## recreate the school runtime environment with fresh local secrets and the required school origin
recreate-env-school:
	@umask 077; sed \
		-e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)|" \
		-e "s|^AUTH_INTERNAL_TOKEN=.*|AUTH_INTERNAL_TOKEN=$$(openssl rand -hex 32)|" \
		-e "s|^AUTH_REFRESH_SUCCESSOR_KEY=.*|AUTH_REFRESH_SUCCESSOR_KEY=$$(openssl rand -hex 32)|" \
		-e "s|^AUTH_PROJECT_API_TOKEN_PEPPER=.*|AUTH_PROJECT_API_TOKEN_PEPPER=$$(openssl rand -hex 32)|" \
		-e "s|^VAULT_DEV_ROOT_TOKEN=.*|VAULT_DEV_ROOT_TOKEN=$$(openssl rand -hex 32)|" \
		-e "s|^VAULT_DB_ADMIN_PASSWORD=.*|VAULT_DB_ADMIN_PASSWORD=$$(openssl rand -hex 32)|" \
		-e "s|^APP_ORIGIN=.*|APP_ORIGIN=https://*.paris.42.school:8443|" \
		-e "s|^AUTH_JWT_ISSUER=.*|AUTH_JWT_ISSUER=https://*.paris.42.school:8443/auth|" \
		.env.example > "$(DEPLOY_SCHOOL_ENV_FILE)"

## remove an isolated deployment, volumes, orphans, and local images
fclean-%: validate-deployment-%
	$(call deployment_compose,$*) down --volumes --remove-orphans --rmi local

## remove host build caches when an isolated deployment bind mounts source files
ffclean-%:
	@if [ "$(call deployment_source_mounts,$*)" = "true" ]; then \
		docker run --rm -v $(CURDIR)/frontend:/target -w /target docker.io/library/alpine \
			sh -c "rm -rf node_modules dist build .vite .tanstack .flowbite-react .cache .eslintcache .stylelintcache coverage *.tsbuildinfo vite.config.js vite.config.d.ts"; \
		docker run --rm -v $(CURDIR)/backend:/target -w /target docker.io/library/alpine \
			sh -c "rm -rf node_modules dist build .cache .eslintcache coverage *.tsbuildinfo"; \
		docker run --rm -v $(CURDIR)/auth:/target -w /target docker.io/library/alpine \
			sh -c "rm -rf tmp .cache coverage.out"; \
	fi

## remove an isolated deployment database volume and dependent containers
wipe-db-%: validate-deployment-%
	$(call deployment_compose,$*) stop nginx backend auth db
	for svc in nginx backend auth db; do \
	  ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(call deployment_project,$*) --filter label=com.docker.compose.service=$$svc); \
	  if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi; \
	done
	docker volume ls -q --filter label=com.docker.compose.project=$(call deployment_project,$*) \
		--filter label=com.docker.compose.volume=db_data | xargs -r docker volume rm -f

## remove an isolated deployment RustFS volume
wipe-storage-%: validate-deployment-%
	$(call deployment_compose,$*) stop rustfs
	ids=$$(docker ps -aq --filter label=com.docker.compose.project=$(call deployment_project,$*) --filter label=com.docker.compose.service=rustfs); \
	if [ -n "$$ids" ]; then echo $$ids | xargs -r docker rm -f; fi
	docker volume ls -q --filter label=com.docker.compose.project=$(call deployment_project,$*) \
		--filter label=com.docker.compose.volume=rustfs_data | xargs -r docker volume rm -f

## run migrations and runtime grants for an isolated deployment
migrate-deploy-%: validate-deployment-%
	$(call deployment_compose,$*) --profile tools run --rm migration
	@env_file="$(call deployment_env_file,$*)"; case "$$env_file" in */*) ;; *) env_file="./$$env_file" ;; esac; \
	set -a; . "$$env_file"; set +a; \
	$(call deployment_compose,$*) exec -T db psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" < db/runtime-grants.sql

## fully recreate an isolated deployment; the school profile also recreates its runtime environment
rere-%:
	+$(MAKE) recreate-env-$*
	+$(MAKE) fclean-$*
	+$(MAKE) ffclean-$*
	+$(MAKE) wipe-db-$*
	+$(MAKE) wipe-storage-$*
	+$(MAKE) deploy-$*
	+$(MAKE) migrate-deploy-$*

## inject demo data into an isolated deployment
seed-%: validate-deployment-%
	$(call deployment_compose,$*) --profile tools run --rm migration npx tsx scripts/vault-seed.ts

validate-deployment-%:
	@test -n "$(filter $*,$(DEPLOYMENTS))" || (echo "Unknown deployment profile: $*" >&2; exit 1)
	@test -f "$(call deployment_env_file,$*)" || (echo "Missing $(call deployment_name,$*) runtime env: $(call deployment_env_file,$*)" >&2; exit 1)
	@test -f "$(call deployment_compose_file,$*)" || (echo "Missing $(call deployment_name,$*) Compose override: $(call deployment_compose_file,$*)" >&2; exit 1)
	@if [ "$*" = "dev" ] || [ "$*" = "school" ]; then \
		env_file="$(call deployment_env_file,$*)"; case "$$env_file" in */*) ;; *) env_file="./$$env_file" ;; esac; \
		set -a; . "$$env_file"; set +a; \
		test "$$NODE_ENV" = "development" || (echo "NODE_ENV must be development for $* deployment" >&2; exit 1); \
		if [ "$*" = "dev" ]; then \
			test "$$APP_ORIGIN" = "https://tomato-dev.iops.dev" || (echo "APP_ORIGIN must be https://tomato-dev.iops.dev for VM development" >&2; exit 1); \
			test "$$AUTH_JWT_ISSUER" = "https://tomato-dev.iops.dev/auth" || (echo "AUTH_JWT_ISSUER must be https://tomato-dev.iops.dev/auth for VM development" >&2; exit 1); \
		else \
			test "$$APP_ORIGIN" = "https://*.paris.42.school:8443" || (echo "APP_ORIGIN must be https://*.paris.42.school:8443 for school evaluation" >&2; exit 1); \
			test "$$AUTH_JWT_ISSUER" = "https://*.paris.42.school:8443/auth" || (echo "AUTH_JWT_ISSUER must be https://*.paris.42.school:8443/auth for school evaluation" >&2; exit 1); \
		fi; \
	fi
	@if [ "$*" = "prod" ]; then \
		env_file="$(call deployment_env_file,$*)"; set -a; . "$$env_file"; set +a; \
		test "$$NODE_ENV" = "production" || (echo "NODE_ENV must be production for production deployment" >&2; exit 1); \
	fi

## validate the narrow school runtime origin and issuer
validate-school-runtime: validate-deployment-school

.PHONY: recreate-env-school validate-school-runtime
.SECONDARY: validate-deployment-dev validate-deployment-school validate-deployment-prod