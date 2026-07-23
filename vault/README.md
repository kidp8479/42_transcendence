# Local Vault foundation

`docker-compose.yml` runs Vault in **development mode only**. Its root token is
used only by the `vault-bootstrap` container to configure the local instance;
the frontend, backend, and auth containers never receive it.

`vault-bootstrap` creates:

- the `transit`, KV v2, AppRole, and PostgreSQL Database mounts;
- a non-exportable Ed25519 Transit key named `auth-access-jwt`;
- independent `auth-runtime`, `backend-runtime`, and `migration` dynamic
  database roles (runtime roles renewable for 8 hours; the migration role is
  deliberately short-lived at 15m/1h because a migration runs in minutes);
- AppRole Secret IDs written with mode `0600` to separate Compose volumes.

Policy content lives in `bootstrap/policies/*.hcl` and grant/creation SQL in
`bootstrap/sql/*.sql`; `bootstrap.sh` is thin glue that loads those files.
Note: Vault splits creation/revocation statements on semicolons, so SQL
comments in those files must never contain one.

## Database grant model

Vault mints a fresh PostgreSQL login role per lease. Privileges are **never**
attached to those ephemeral roles; they live on static `NOLOGIN` parents
created by `db/init/01-vault-roles.sql` on first cluster initialization:

| Parent | Purpose |
|---|---|
| `app_owner` | Owns every application object; the future Vault migration lease will `SET ROLE` into it so DDL ownership survives lease expiry |
| `auth_runtime` | Go auth: auth/session/identity/audit tables (no `UPDATE` on the immutable `AuthEvent`) |
| `backend_runtime` | NestJS: application-domain tables, read-only `User`, never `PasswordCredential` |
| `vault_db_admin` | `CREATEROLE` management user for Vault's database engine — separate from the bootstrap superuser so `make shell-db` and future root-credential rotation don't collide |

Lease roles are just `CREATE ROLE ... IN ROLE <parent> INHERIT`, which means
credential issuance works on a fresh, unmigrated database and live leases see
newly migrated tables immediately.

Table-level grants for the two runtime parents are applied by `make migrate`
from `db/runtime-grants.sql` **after** Prisma migrations run (grants can only
target existing tables, and `ALTER DEFAULT PRIVILEGES` cannot express the
`PasswordCredential` exclusion). When a migration adds or renames an auth or
application table, update `db/runtime-grants.sql` in the same PR.

**Existing dev databases** (volume created before this model existed): the
`db/init` scripts only run on first cluster initialization, so either run
`make wipe-db` and recreate, or apply `db/init/01-vault-roles.sql` manually
and set the `vault_db_admin` password from `VAULT_DB_ADMIN_PASSWORD`.

## Runtime consumers

Go auth uses its mounted `role_id` and `secret_id` to authenticate directly
with AppRole. It keeps the resulting Vault token, KV values, and dynamic
PostgreSQL credentials only in process memory. It reads the OAuth credentials
and backend-to-auth credential from KV, asks Vault for the `auth-runtime`
database lease, and swaps to a freshly connected pool whenever that lease is
renewed. Its health endpoint returns `503` and request handling stops when
Vault credentials cannot be renewed with a one-minute safety margin.

The AppRole token has a nine-hour maximum TTL to bound a leaked in-memory
token. Before that maximum is reached, the auth process re-authenticates using
the Secret ID retained in memory and issues a new database lease/pool; it
never falls back to `DATABASE_URL`, OAuth environment variables, or
`AUTH_INTERNAL_TOKEN`. Go's `vault.Runtime.Sign` is the narrow, Transit-backed
Ed25519 signing interface for the later JWT feature; it cannot export private
key material.

NestJS and the migration process have not yet consumed their separate Vault
credentials. Do not treat this development instance as production-ready:
initialization, unseal, custody, TLS, storage, backup, HA, root-credential rotation
(`vault write -force database/rotate-root/postgresql`), and the emergency
root-token runbook remain unresolved operational blockers.

Dev-mode Vault is in-memory: a Vault container restart loses all
configuration and leases, and `vault-bootstrap` (a one-shot) does not re-run
automatically — bring the stack back with `make up` (or `make restart`),
which re-executes the bootstrap.
