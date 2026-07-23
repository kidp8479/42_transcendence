#!/bin/sh
set -eu

required_env() {
	if [ -z "$(eval "printf '%s' \"\${$1:-}\"")" ]; then
		echo "$1 is required" >&2
		exit 1
	fi
}

for name in VAULT_ADDR VAULT_TOKEN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB AUTH_INTERNAL_TOKEN; do
	required_env "$name"
done

write_policy() {
	name=$1
	cat >"/tmp/${name}.hcl"
	vault policy write "$name" "/tmp/${name}.hcl"
	rm "/tmp/${name}.hcl"
}

write_policy auth-runtime <<'EOF'
path "transit/sign/auth-access-jwt" {
  capabilities = ["update"]
}
path "kv/data/auth/oauth" {
  capabilities = ["read"]
}
path "kv/data/internal/backend-auth" {
  capabilities = ["read"]
}
path "database/creds/auth-runtime" {
  capabilities = ["read"]
}
path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF

write_policy backend-runtime <<'EOF'
path "kv/data/internal/backend-auth" {
  capabilities = ["read"]
}
path "database/creds/backend-runtime" {
  capabilities = ["read"]
}
path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF

write_policy migration <<'EOF'
path "database/creds/migration" {
  capabilities = ["read"]
}
path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF

vault secrets enable -path=transit transit 2>/dev/null || true
vault secrets enable -path=kv -version=2 kv 2>/dev/null || true
vault auth enable approle 2>/dev/null || true
vault secrets enable database 2>/dev/null || true

vault write transit/keys/auth-access-jwt type=ed25519 exportable=false allow_plaintext_backup=false >/dev/null
vault kv put kv/auth/oauth \
	oauth_42_client_id="${OAUTH_42_CLIENT_ID:-}" \
	oauth_42_client_secret="${OAUTH_42_CLIENT_SECRET:-}" \
	oauth_google_client_id="${OAUTH_GOOGLE_CLIENT_ID:-}" \
	oauth_google_client_secret="${OAUTH_GOOGLE_CLIENT_SECRET:-}" >/dev/null
vault kv put kv/internal/backend-auth internal_token="$AUTH_INTERNAL_TOKEN" >/dev/null

vault write database/config/postgresql \
	plugin_name=postgresql-database-plugin \
	allowed_roles="auth-runtime,backend-runtime,migration" \
	connection_url="postgresql://{{username}}:{{password}}@db:5432/${POSTGRES_DB}?sslmode=disable" \
	username="$POSTGRES_USER" \
	password="$POSTGRES_PASSWORD" >/dev/null

vault write database/roles/auth-runtime \
	db_name=postgresql \
	default_ttl=8h \
	max_ttl=8h \
	creation_statements=@/vault/bootstrap/sql/auth-runtime.sql >/dev/null
vault write database/roles/backend-runtime \
	db_name=postgresql \
	default_ttl=8h \
	max_ttl=8h \
	creation_statements=@/vault/bootstrap/sql/backend-runtime.sql >/dev/null
vault write database/roles/migration \
	db_name=postgresql \
	default_ttl=8h \
	max_ttl=8h \
	creation_statements=@/vault/bootstrap/sql/migration.sql >/dev/null

create_approle() {
	role=$1
	policy=$2
	secret_file=$3

	vault write "auth/approle/role/${role}" \
		token_policies="$policy" \
		token_ttl=1h \
		token_max_ttl=4h \
		secret_id_ttl=24h \
		secret_id_num_uses=0 \
		bind_secret_id=true >/dev/null

	umask 077
	vault read -field=role_id "auth/approle/role/${role}/role-id" >"${secret_file}/role_id"
	vault write -f -field=secret_id "auth/approle/role/${role}/secret-id" >"${secret_file}/secret_id"
}

create_approle auth-runtime auth-runtime /run/secrets/auth-runtime
create_approle backend-runtime backend-runtime /run/secrets/backend-runtime
create_approle migration migration /run/secrets/migration

echo "Vault local development bootstrap completed."
