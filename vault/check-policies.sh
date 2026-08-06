#!/bin/sh
set -eu

: "${VAULT_ADDR:?VAULT_ADDR is required}"

fail() {
	echo "Vault policy check failed: $*" >&2
	exit 1
}

login() {
	secret_dir=$1
	vault write -field=token auth/approle/login \
		role_id="$(cat "${secret_dir}/role_id")" \
		secret_id="$(cat "${secret_dir}/secret_id")"
}

allow() {
	token=$1
	shift
	VAULT_TOKEN="$token" "$@" >/dev/null
}

deny() {
	token=$1
	shift
	if VAULT_TOKEN="$token" "$@" >/dev/null 2>&1; then
		fail "unexpectedly allowed: $*"
	fi
}

auth_token=$(login /run/secrets/auth)
backend_token=$(login /run/secrets/backend)
migration_token=$(login /run/secrets/migration)

# Each workload may use only its own policy-approved database endpoint.
allow "$auth_token" vault read database/creds/auth-runtime
allow "$backend_token" vault read database/creds/backend-runtime
allow "$migration_token" vault read database/creds/migration
deny "$auth_token" vault read database/creds/backend-runtime
deny "$backend_token" vault read database/creds/auth-runtime
deny "$migration_token" vault read database/creds/auth-runtime

# KV isolation: only auth and backend may read their shared internal credential;
# the OAuth credentials stay exclusively with Go auth.
allow "$auth_token" vault read kv/data/auth/oauth
allow "$auth_token" vault read kv/data/auth/refresh-successor
allow "$auth_token" vault read kv/data/auth/project-api-token-pepper
allow "$auth_token" vault read kv/data/internal/backend-auth
allow "$backend_token" vault read kv/data/internal/backend-auth
deny "$backend_token" vault read kv/data/auth/oauth
deny "$backend_token" vault read kv/data/auth/refresh-successor
deny "$backend_token" vault read kv/data/auth/project-api-token-pepper
deny "$migration_token" vault read kv/data/auth/project-api-token-pepper
deny "$migration_token" vault read kv/data/internal/backend-auth

# Transit can sign and verify but can never export the private signing key.
input=$(printf '%s' vault-policy-check | base64 | tr -d '\n')
signature=$(VAULT_TOKEN="$auth_token" vault write -field=signature \
	transit/sign/auth-access-jwt input="$input")
valid=$(VAULT_TOKEN="$auth_token" vault write -field=valid \
	transit/verify/auth-access-jwt input="$input" signature="$signature")
[ "$valid" = "true" ] || fail "Transit signature did not verify"
deny "$auth_token" vault read transit/export/signing-key/auth-access-jwt
deny "$backend_token" vault write transit/sign/auth-access-jwt input="$input"

# A dynamic database lease can be renewed by its owning workload.
lease_id=$(VAULT_TOKEN="$auth_token" vault read -field=lease_id \
	database/creds/auth-runtime)
VAULT_TOKEN="$auth_token" vault lease renew "$lease_id" >/dev/null

echo "Vault policy isolation checks passed"
