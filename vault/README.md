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
Vault credentials cannot be renewed with a one-minute safety margin. At that
point the auth process exits non-zero so its supervisor can restart it; it
does not remain indefinitely unhealthy.

The AppRole token has a nine-hour maximum TTL to bound a leaked in-memory
token. Before that maximum is reached, the auth process re-authenticates using
the Secret ID retained in memory and issues a new database lease/pool; it
never falls back to `DATABASE_URL`, OAuth environment variables, or
`AUTH_INTERNAL_TOKEN`. Go's `vault.Runtime.Sign` is the narrow, Transit-backed
Ed25519 signing interface for the later JWT feature; it cannot export private
key material.

Database roles have an eight-hour maximum lease TTL. When Vault declines a
renewal at that boundary, Go auth and NestJS issue replacement credentials and
atomically refresh their database client rather than continuing on a
near-expiry lease.

NestJS also uses its mounted AppRole files to obtain its backend-to-auth KV
credential and a `backend-runtime` database lease. It atomically publishes a
new Prisma client only after it connects successfully, then drains the former
client for 30 seconds. Its `/api/health` endpoint returns `503` until the
Vault runtime is ready and again after a fatal renewal failure; transient
Vault outages keep it ready while its existing credentials remain valid.

`make migrate` starts the explicit `migration` Compose workload. It receives a
short-lived `migration` lease from its own AppRole and runs `prisma migrate
deploy`; it never receives the bootstrap `DATABASE_URL`. Use
`make migrate-dev NAME=lowercase-name` to author a migration through that same
AppRole and lease. Prisma requires `CREATEDB` for its disposable shadow
database, so the migration lease's `app_owner` parent has that capability.
This is an intentional local student-project tradeoff; runtime roles cannot
create databases. The subsequent grants step remains an explicit
developer/operator action through `make` and the database shell's bootstrap
user.

Migrations are forward-only. Inspect generated SQL before committing it and
never modify a migration recorded in `_prisma_migrations`. If deployment fails
before it is recorded, correct the cause and rerun `make migrate`; if any part
is recorded, recover through a reviewed corrective migration. TR-69 additionally
preflights that every project has a member, assigns the oldest `ADMIN` (or
oldest member) as its deterministic `OWNER`, and rejects a second owner through
a partial unique index. Its persistence rollout deliberately leaves the legacy
opaque `AuthSession` path untouched until the later JWT/refresh cutover.

Run `make check-vault-prisma` to verify dynamic credential rotation, runtime
database-role permissions and denials, and the TR-69 upgrade fixture after
migrations.

Before the first Vault migration on a development volume created before this
cutover, the team must run `make wipe-db` and then `make up`: legacy schema
objects are owned by the former bootstrap role and must not be silently
re-privileged to preserve a compatibility path.

Do not treat this development instance as production-ready:
initialization, unseal, custody, TLS, storage, backup, HA, root-credential rotation
(`vault write -force database/rotate-root/postgresql`), and the emergency
root-token runbook remain unresolved operational blockers.

Dev-mode Vault is in-memory: a Vault container restart loses all
configuration and leases, and `vault-bootstrap` (a one-shot) does not re-run
automatically — bring the stack back with `make up` (or `make restart`),
which re-executes the bootstrap.
