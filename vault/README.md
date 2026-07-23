# Local Vault foundation

`docker-compose.yml` runs Vault in **development mode only**. Its root token is
used only by the `vault-bootstrap` container to configure the local instance;
the frontend, backend, and auth containers never receive it.

`vault-bootstrap` creates:

- the `transit`, KV v2, AppRole, and PostgreSQL Database mounts;
- a non-exportable Ed25519 Transit key named `auth-access-jwt`;
- independent `auth-runtime`, `backend-runtime`, and `migration` database
  roles with renewable eight-hour credentials;
- AppRole Secret IDs written with mode `0600` to separate Compose volumes.

The current application processes still use their existing database connection
configuration. Subsequent Auth 7.1 changes must consume only their own
`role_id` and mounted `secret_id`, use direct Vault clients, renew tokens and
leases, and remove runtime static database credentials. Do not treat this
development instance as production-ready: initialization, unseal, custody,
TLS, storage, backup, HA, and the emergency root-token runbook remain
unresolved operational blockers.

The SQL grants are deliberately table-specific. Update them whenever a Prisma
migration adds or changes an auth or application table; do not replace them
with schema-wide runtime grants.
