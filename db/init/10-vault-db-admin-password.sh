#!/bin/sh
# Runs inside the postgres image's docker-entrypoint-initdb.d on first
# cluster initialization, after 01-vault-roles.sql. Sets the vault_db_admin
# password from the environment so no credential is baked into SQL files.
set -eu

: "${VAULT_DB_ADMIN_PASSWORD:?VAULT_DB_ADMIN_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
	-U "$POSTGRES_USER" \
	-d "$POSTGRES_DB" \
	-v password="$VAULT_DB_ADMIN_PASSWORD" \
	<<-'EOF'
	ALTER ROLE vault_db_admin PASSWORD :'password';
	EOF
