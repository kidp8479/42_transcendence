# Environment-specific deployment lifecycle targets. The root Makefile owns
# school evaluation and local development; this file owns the VM test and VPS
# production profiles.

DEPLOY_SECRETS_DIR ?= /srv/transcendence
DEPLOYMENTS := test prod

DEPLOY_TEST_ENV_FILE ?= $(DEPLOY_SECRETS_DIR)/test/secrets/runtime.env
DEPLOY_TEST_COMPOSE_FILE ?= ops/compose/test.yml
DEPLOY_TEST_PROJECT ?= transcendence-test

DEPLOY_PROD_ENV_FILE ?= $(DEPLOY_SECRETS_DIR)/production/secrets/runtime.env
DEPLOY_PROD_COMPOSE_FILE ?= ops/compose/production.yml
DEPLOY_PROD_PROJECT ?= transcendence-prod

DEPLOY_test_NAME := test
DEPLOY_test_ENV_FILE = $(DEPLOY_TEST_ENV_FILE)
DEPLOY_test_COMPOSE_FILE = $(DEPLOY_TEST_COMPOSE_FILE)
DEPLOY_test_PROJECT = $(DEPLOY_TEST_PROJECT)
DEPLOY_test_SOURCE_MOUNTS := false
DEPLOY_test_COMPOSE_ENV := APP_INGRESS_PORT=8444 APP_INGRESS_BIND_ADDRESS=127.0.0.1 NGINX_CONFIG_TEMPLATE=./nginx/default.production.conf.template

DEPLOY_prod_NAME := production
DEPLOY_prod_ENV_FILE = $(DEPLOY_PROD_ENV_FILE)
DEPLOY_prod_COMPOSE_FILE = $(DEPLOY_PROD_COMPOSE_FILE)
DEPLOY_prod_PROJECT = $(DEPLOY_PROD_PROJECT)
DEPLOY_prod_SOURCE_MOUNTS := false
DEPLOY_prod_COMPOSE_ENV := APP_INGRESS_BIND_ADDRESS=127.0.0.1 NGINX_CONFIG_TEMPLATE=./nginx/default.production.conf.template

deployment_value = $(DEPLOY_$(1)_$(2))
deployment_name = $(call deployment_value,$(1),NAME)
deployment_env_file = $(call deployment_value,$(1),ENV_FILE)
deployment_compose_file = $(call deployment_value,$(1),COMPOSE_FILE)
deployment_project = $(call deployment_value,$(1),PROJECT)
deployment_source_mounts = $(call deployment_value,$(1),SOURCE_MOUNTS)
deployment_compose_env = $(call deployment_value,$(1),COMPOSE_ENV)
deployment_compose = $(call deployment_compose_env,$(1)) $(COMPOSE_COMMAND) --project-name $(call deployment_project,$(1)) \
	--env-file $(call deployment_env_file,$(1)) -f docker-compose.yml \
	-f $(call deployment_compose_file,$(1))

## build and start an isolated deployment (requires its runtime environment)
deploy-%: validate-deployment-%
	$(call deployment_compose,$*) config --quiet
	$(call deployment_compose,$*) up --build -d

## build and start the VM test environment
start-test: deploy-test

## build and start the production environment
start-prod: deploy-prod

## rotate locally generated secrets while retaining deployment-specific configuration
recreate-env-%:
	@env_file="$(call deployment_env_file,$*)"; \
	test -f "$$env_file" || (echo "Missing $(call deployment_name,$*) runtime env: $$env_file" >&2; exit 1); \
	postgres_password="$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)"; \
	auth_internal_token="$$(openssl rand -hex 32)"; \
	auth_refresh_successor_key="$$(openssl rand -hex 32)"; \
	auth_project_api_token_pepper="$$(openssl rand -hex 32)"; \
	seed_password="$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)"; \
	vault_dev_root_token="$$(openssl rand -hex 32)"; \
	vault_db_admin_password="$$(openssl rand 128 | LC_ALL=C tr -dc 'a-zA-Z0-9.$$@!{}' | head -c 16)"; \
	set_env_value() { \
		key="$$1"; value="$$2"; \
		if grep -q "^$$key=" "$$env_file"; then \
			sed -i "s|^$$key=.*|$$key=$$value|" "$$env_file"; \
		else \
			printf '\n%s=%s\n' "$$key" "$$value" >>"$$env_file"; \
		fi; \
	}; \
	set_env_value POSTGRES_PASSWORD "'$$postgres_password'"; \
	set_env_value AUTH_INTERNAL_TOKEN "$$auth_internal_token"; \
	set_env_value AUTH_REFRESH_SUCCESSOR_KEY "$$auth_refresh_successor_key"; \
	set_env_value AUTH_PROJECT_API_TOKEN_PEPPER "$$auth_project_api_token_pepper"; \
	set_env_value SEED_PASSWORD "'$$seed_password'"; \
	set_env_value VAULT_DEV_ROOT_TOKEN "$$vault_dev_root_token"; \
	set_env_value VAULT_DB_ADMIN_PASSWORD "'$$vault_db_admin_password'"; \
	chmod 0600 "$$env_file"

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
	$(call deployment_compose,$*) --profile tools build migration
	$(call deployment_compose,$*) --profile tools run --rm migration
	@env_file="$(call deployment_env_file,$*)"; case "$$env_file" in */*) ;; *) env_file="./$$env_file" ;; esac; \
	set -a; . "$$env_file"; set +a; \
	$(call deployment_compose,$*) exec -T db psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" < db/runtime-grants.sql

## fully recreate an isolated deployment
rere-%:
	+$(MAKE) recreate-env-$*
	+$(MAKE) fclean-$*
	+$(MAKE) deploy-$*
	+$(MAKE) migrate-deploy-$*

## inject demo data into an isolated deployment
seed-%: validate-deployment-%
	@grep -q "^SEED_PASSWORD=." "$(call deployment_env_file,$*)" || (echo "SEED_PASSWORD must be set for $* seeding" >&2; exit 1)
	$(call deployment_compose,$*) --profile tools run --rm migration npx tsx scripts/vault-seed.ts

validate-deployment-%:
	@test -n "$(filter $*,$(DEPLOYMENTS))" || (echo "Unknown deployment profile: $*" >&2; exit 1)
	@test -f "$(call deployment_env_file,$*)" || (echo "Missing $(call deployment_name,$*) runtime env: $(call deployment_env_file,$*)" >&2; exit 1)
	@test -f "$(call deployment_compose_file,$*)" || (echo "Missing $(call deployment_name,$*) Compose override: $(call deployment_compose_file,$*)" >&2; exit 1)
	@env_file="$(call deployment_env_file,$*)"; case "$$env_file" in */*) ;; *) env_file="./$$env_file" ;; esac; \
		set -a; . "$$env_file"; set +a
	@if [ "$*" = "test" ]; then \
		env_file="$(call deployment_env_file,$*)"; case "$$env_file" in */*) ;; *) env_file="./$$env_file" ;; esac; \
		set -a; . "$$env_file"; set +a; \
		test "$$NODE_ENV" = "development" || (echo "NODE_ENV must be development for $* deployment" >&2; exit 1); \
		test "$$APP_ORIGIN" = "https://tomato-dev.iops.dev" || (echo "APP_ORIGIN must be https://tomato-dev.iops.dev for VM test" >&2; exit 1); \
		test "$$AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN" = "https://tomato-dev.iops.dev" || (echo "AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN must be https://tomato-dev.iops.dev for VM test" >&2; exit 1); \
		test "$$AUTH_JWT_ISSUER" = "https://tomato-dev.iops.dev/auth" || (echo "AUTH_JWT_ISSUER must be https://tomato-dev.iops.dev/auth for VM test" >&2; exit 1); \
	fi
	@if [ "$*" = "prod" ]; then \
		env_file="$(call deployment_env_file,$*)"; case "$$env_file" in */*) ;; *) env_file="./$$env_file" ;; esac; \
		set -a; . "$$env_file"; set +a; \
		test -n "$$APP_INGRESS_PORT" || (echo "APP_INGRESS_PORT must be set for production deployment" >&2; exit 1); \
		test "$$NODE_ENV" = "production" || (echo "NODE_ENV must be production for production deployment" >&2; exit 1); \
		test "$$APP_ORIGIN" = "https://tomato.iops.dev" || (echo "APP_ORIGIN must be https://tomato.iops.dev for production deployment" >&2; exit 1); \
		test "$$AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN" = "https://tomato.iops.dev" || (echo "AUTH_OAUTH_PROVIDERS_CALLBACK_ORIGIN must be https://tomato.iops.dev for production deployment" >&2; exit 1); \
		test "$$AUTH_JWT_ISSUER" = "https://tomato.iops.dev/auth" || (echo "AUTH_JWT_ISSUER must be https://tomato.iops.dev/auth for production deployment" >&2; exit 1); \
	fi

.SECONDARY: validate-deployment-test validate-deployment-prod