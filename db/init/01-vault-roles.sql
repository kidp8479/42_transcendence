-- Static parent roles for Vault dynamic credentials.
--
-- Vault's Database secrets engine mints a short-lived login role per lease
-- ("v-approle-auth-run-..."). Grants must NOT be attached to those ephemeral
-- roles: they snapshot the schema at issue time (new tables from later
-- migrations stay invisible until the lease expires), they fail entirely on a
-- fresh database where the tables do not exist yet, and any object created by
-- an ephemeral role blocks Vault's DROP ROLE revocation.
--
-- Instead, all privileges live on three static NOLOGIN parents, and Vault's
-- creation statements reduce to CREATE ROLE ... IN ROLE <parent> INHERIT.
--
--   app_owner        owns every application object; a future Vault migration
--                    lease will SET ROLE into it so DDL ownership survives expiry
--   auth_runtime     Go auth: auth/session/identity/audit tables only
--   backend_runtime  NestJS: application-domain tables, read-only User,
--                    never PasswordCredential
--
-- Table-level grants for the two runtime parents are applied by
-- db/runtime-grants.sql AFTER Prisma migrations create the tables. The
-- current make migrate path uses the explicit bootstrap user; its future
-- Vault migration lease will SET ROLE into app_owner. ALTER DEFAULT
-- PRIVILEGES cannot express a per-table exclusion such as PasswordCredential,
-- so grants are re-applied explicitly after each migration instead.
--
-- This script runs from the postgres image's docker-entrypoint-initdb.d on
-- first cluster initialization only; it is written to be idempotent anyway.

DO $$
BEGIN
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_owner') THEN
		CREATE ROLE app_owner NOLOGIN;
	END IF;
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'auth_runtime') THEN
		CREATE ROLE auth_runtime NOLOGIN;
	END IF;
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'backend_runtime') THEN
		CREATE ROLE backend_runtime NOLOGIN;
	END IF;
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vault_db_admin') THEN
		-- Dedicated management user for Vault's database secrets engine:
		-- creates/drops the ephemeral lease roles. Not a superuser, and
		-- separate from the bootstrap POSTGRES_USER so `make shell-db`
		-- and future root-credential rotation do not collide.
		CREATE ROLE vault_db_admin LOGIN CREATEROLE PASSWORD NULL;
	END IF;
END
$$;

-- vault_db_admin gets its password injected at bootstrap time (see
-- db/init/10-vault-db-admin-password.sh); CREATEROLE alone cannot grant
-- membership in roles it does not administer, so hand it admin rights on
-- the three parents explicitly.
GRANT app_owner TO vault_db_admin WITH ADMIN OPTION;
GRANT auth_runtime TO vault_db_admin WITH ADMIN OPTION;
GRANT backend_runtime TO vault_db_admin WITH ADMIN OPTION;

-- PostgreSQL 16: CREATEROLE gives the creator only implicit ADMIN on roles
-- it creates, not membership - but REASSIGN OWNED (used by Vault's
-- revocation statements for the migration role) requires real membership in
-- the source role. self_grant makes every lease role vault_db_admin creates
-- automatically grant it SET+INHERIT membership, so revocation always works.
ALTER ROLE vault_db_admin SET createrole_self_grant = 'set, inherit';

-- Application objects live in schema public, owned by app_owner.
GRANT ALL ON SCHEMA public TO app_owner;
GRANT USAGE ON SCHEMA public TO auth_runtime;
GRANT USAGE ON SCHEMA public TO backend_runtime;
