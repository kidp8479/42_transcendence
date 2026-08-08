#!/bin/sh
# Local development Vault bootstrap. Thin imperative glue only: all policy
# (HCL) and grant (SQL) content lives in version-controlled files under
# /vault/bootstrap, mounted read-only by the vault-bootstrap Compose service.
set -eu

# Workload secret files must never be readable by other users; set once,
# deliberately. The Nginx Agent credentials are the sole exception below:
# rootless Podman does not provide a portable ownership mapping between this
# bootstrap container and HashiCorp's non-root Agent user.
umask 077

POLICY_DIR=${POLICY_DIR:-/vault/bootstrap/policies}
SQL_DIR=${SQL_DIR:-/vault/bootstrap/sql}
SECRETS_DIR=${SECRETS_DIR:-/run/secrets}
PKI_CA_DIR=${PKI_CA_DIR:-/run/pki-ca}
NGINX_TLS_DIR=${NGINX_TLS_DIR:-/run/nginx-tls}

: "${VAULT_ADDR:?VAULT_ADDR is required}"
: "${VAULT_TOKEN:?VAULT_TOKEN is required}"
: "${VAULT_DB_ADMIN_PASSWORD:?VAULT_DB_ADMIN_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${AUTH_INTERNAL_TOKEN:?AUTH_INTERNAL_TOKEN is required}"
: "${AUTH_REFRESH_SUCCESSOR_KEY:?AUTH_REFRESH_SUCCESSOR_KEY is required}"
: "${AUTH_PROJECT_API_TOKEN_PEPPER:?AUTH_PROJECT_API_TOKEN_PEPPER is required}"
: "${SEED_PASSWORD:?SEED_PASSWORD is required}"

on_exit() {
	rc=$?
	if [ "$rc" -ne 0 ]; then
		echo "BOOTSTRAP FAILED (exit $rc) - see last step above" >&2
	fi
}
trap on_exit EXIT

step() { echo ">>> $*"; }

quiet() { "$@" >/dev/null; }

# Tolerate exactly "path is already in use" (idempotent re-run); fail loudly
# on anything else (bad token, connection refused, sealed Vault, typos).
enable_once() {
	out=$(vault "$@" 2>&1) && return 0
	case "$out" in
	*"path is already in use"*) return 0 ;;
	esac
	printf '%s\n' "$out" >&2
	return 1
}

step "waiting for Vault at ${VAULT_ADDR}"
i=0
until vault status >/dev/null 2>&1; do
	i=$((i + 1))
	if [ "$i" -ge 30 ]; then
		echo "vault not reachable at ${VAULT_ADDR} after 30s" >&2
		exit 1
	fi
	sleep 1
done

step "writing policies from ${POLICY_DIR}"
for policy_file in "$POLICY_DIR"/*.hcl; do
	vault policy write "$(basename "$policy_file" .hcl)" "$policy_file"
done

step "enabling secrets engines and AppRole auth"
enable_once secrets enable -path=transit transit
enable_once secrets enable -path=kv -version=2 kv
enable_once auth enable approle
enable_once secrets enable database
enable_once secrets enable -path=pki pki

step "configuring local development PKI"
mkdir -p "$PKI_CA_DIR" "$NGINX_TLS_DIR"
chmod 0700 "$PKI_CA_DIR"
# This volume is mounted only by vault-bootstrap, nginx-tls-agent, and Nginx
# (read-only). Rootless Podman cannot portably share ownership between the
# bootstrap image and the Agent's image user, so volume isolation—not UID
# mapping—forms the access boundary.
chmod 0777 "$NGINX_TLS_DIR"

quiet vault secrets tune -max-lease-ttl=87600h pki

# Vault dev mode loses its in-memory PKI on restart. Persist this local-only
# root so developers do not need to re-trust a new CA after every restart.
if [ -s "$PKI_CA_DIR/root.pem" ]; then
	quiet vault write pki/config/ca "pem_bundle=@${PKI_CA_DIR}/root.pem"
else
	root_json=$(mktemp)
	vault write -format=json pki/root/generate/exported \
		common_name="Task Rabbit local development CA" \
		ttl=87600h >"$root_json"
	jq -r '.data.certificate, .data.private_key' "$root_json" >"$PKI_CA_DIR/root.pem"
	jq -r '.data.certificate' "$root_json" >"$PKI_CA_DIR/root.crt"
	rm -f "$root_json"
	chmod 0600 "$PKI_CA_DIR/root.pem"
	chmod 0644 "$PKI_CA_DIR/root.crt"
fi

quiet vault write pki/roles/local-dev \
	allowed_domains=localhost \
	allow_bare_domains=true \
	allow_subdomains=false \
	allow_ip_sans=true \
	max_ttl=720h
quiet vault write pki/roles/paris-42-wildcard \
	allowed_domains=paris.42.school \
	allow_bare_domains=false \
	allow_subdomains=true \
	allow_wildcard_certificates=true \
	max_ttl=720h
quiet vault write pki/roles/public-domains \
	allowed_domains=tomato.iops.dev,tomato-dev.iops.dev \
	allow_bare_domains=true \
	allow_subdomains=false \
	max_ttl=720h

step "creating Transit signing key"
# create-or-noop on an existing key; re-run-safe without any error tolerance
quiet vault write transit/keys/auth-access-jwt \
	type=ed25519 exportable=false allow_plaintext_backup=false

step "writing KV secrets"
quiet vault kv put kv/auth/oauth \
	oauth_42_client_id="${OAUTH_42_CLIENT_ID:-}" \
	oauth_42_client_secret="${OAUTH_42_CLIENT_SECRET:-}" \
	oauth_google_client_id="${OAUTH_GOOGLE_CLIENT_ID:-}" \
	oauth_google_client_secret="${OAUTH_GOOGLE_CLIENT_SECRET:-}"
if [ -z "${OAUTH_42_CLIENT_ID:-}" ] || [ -z "${OAUTH_GOOGLE_CLIENT_ID:-}" ]; then
	echo "WARNING: OAuth client credentials are empty in kv/auth/oauth" >&2
fi
quiet vault kv put kv/internal/backend-auth internal_token="$AUTH_INTERNAL_TOKEN"
quiet vault kv put kv/auth/refresh-successor cipher_key="$AUTH_REFRESH_SUCCESSOR_KEY"
# Seed the auth-only pepper exactly once. A bootstrap rerun must never replace
# an existing secret, including an older incompatible secret shape.
if ! vault kv get -format=json kv/auth/project-api-token-pepper >/dev/null 2>&1; then
	quiet vault kv put kv/auth/project-api-token-pepper pepper="$AUTH_PROJECT_API_TOKEN_PEPPER"
fi
if ! vault kv get -format=json kv/seed/demo-users >/dev/null 2>&1; then
	seed_secret_json=$(mktemp)
	jq -n --arg password "$SEED_PASSWORD" '{ password: $password }' >"$seed_secret_json"
	quiet vault kv put kv/seed/demo-users "@${seed_secret_json}"
	rm -f "$seed_secret_json"
fi

step "configuring PostgreSQL database secrets engine"
# vault_db_admin (created by db/init/01-vault-roles.sql) is a dedicated
# CREATEROLE management user: not the bootstrap superuser, so `make shell-db`
# and a future root-credential rotation cannot collide with it.
database_config_json=$(mktemp)
jq -n \
	--arg allowed_roles "auth-runtime,backend-runtime,migration" \
	--arg connection_url "postgresql://{{username}}:{{password}}@db:5432/${POSTGRES_DB}?sslmode=disable" \
	--arg username "vault_db_admin" \
	--arg password "$VAULT_DB_ADMIN_PASSWORD" \
	'{
		plugin_name: "postgresql-database-plugin",
		allowed_roles: $allowed_roles,
		connection_url: $connection_url,
		username: $username,
		password: $password
	}' >"$database_config_json"
quiet vault write database/config/postgresql "@${database_config_json}"
rm -f "$database_config_json"

step "creating database roles from ${SQL_DIR}"
create_db_role() {
	role=$1
	shift
	quiet vault write "database/roles/${role}" \
		db_name=postgresql \
		creation_statements="@${SQL_DIR}/${role}.sql" \
		"$@"
}
create_db_role auth-runtime default_ttl=8h max_ttl=8h
create_db_role backend-runtime default_ttl=8h max_ttl=8h
# A migration runs in minutes; a short TTL bounds exposure of the most
# privileged credential. Revocation reassigns owned objects to app_owner so
# DROP ROLE can never fail on dependencies.
create_db_role migration default_ttl=15m max_ttl=1h \
	revocation_statements="@${SQL_DIR}/migration-revoke.sql"

step "creating AppRoles and issuing Secret IDs"
create_approle() {
	role=$1
	secret_dir="${SECRETS_DIR}/${role}"

	# token_max_ttl must exceed the 8h database lease horizon: dynamic-secret
	# leases are children of the issuing token and are revoked with it. The
	# 1h token still renews inside that window.
	# secret_id_ttl=0 (non-expiring) is a dev-only choice: dev Vault is
	# in-memory, so every restart re-bootstraps anyway, and an expiring
	# Secret ID would just break long-lived local stacks after a day.
	# Production hardening (single-use, response-wrapped, CIDR-bound Secret
	# IDs) is tracked as an operational blocker.
	quiet vault write "auth/approle/role/${role}" \
		token_policies="$role" \
		token_ttl=1h \
		token_max_ttl=9h \
		secret_id_ttl=0 \
		secret_id_num_uses=0 \
		bind_secret_id=true

	# Re-runs mint a fresh Secret ID; destroy the previous ones so stale
	# credentials cannot outlive the files that held them.
	vault list -format=json "auth/approle/role/${role}/secret-id" 2>/dev/null |
		sed -n 's/^[[:space:]]*"\([^"]*\)",\{0,1\}$/\1/p' |
		while IFS= read -r accessor; do
			quiet vault write "auth/approle/role/${role}/secret-id-accessor/destroy" \
				secret_id_accessor="$accessor"
		done

	vault read -field=role_id "auth/approle/role/${role}/role-id" \
		>"${secret_dir}/role_id"
	vault write -f -field=secret_id "auth/approle/role/${role}/secret-id" \
		>"${secret_dir}/secret_id"

	if [ "$role" = "nginx-tls" ]; then
		# This volume is mounted exclusively by vault-bootstrap and
		# nginx-tls-agent. Let the Agent read its inputs regardless of the
		# rootless container UID mapping; ownership-based sharing is not
		# portable across Docker's Podman shim.
		chmod 0644 "${secret_dir}/role_id" "${secret_dir}/secret_id"
	fi

	if [ "$role" = "backend-runtime" ]; then
		# The production backend image runs as node (UID 1000). Its dedicated
		# secret volume is mounted by no other workload, so retain 0600 while
		# assigning the files to that unprivileged runtime user.
		chown 1000:1000 "${secret_dir}/role_id" "${secret_dir}/secret_id"
	fi
}
create_approle auth-runtime
create_approle backend-runtime
create_approle migration
create_approle nginx-tls

step "Vault local development bootstrap completed"
