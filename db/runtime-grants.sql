-- Table-level grants for the Vault runtime parent roles.
--
-- Applied by `make migrate` AFTER Prisma migrations, because:
--   * grants can only target tables that already exist;
--   * ALTER DEFAULT PRIVILEGES cannot exclude individual tables, and
--     backend_runtime must never gain access to PasswordCredential.
--
-- Keep this file in sync with backend/prisma/schema.prisma: when a migration
-- adds or renames an auth or application table, update the matching list here
-- in the same PR. Re-running is safe (GRANT/REVOKE are idempotent).
--
-- No sequence grants: every primary key is an application-generated UUID,
-- so the schema has no sequences for the runtime roles to use.

-- Go auth: authentication, identity, token/session, audit tables and the
-- canonical user record. AuthEvent is an immutable audit log: no UPDATE;
-- DELETE only for the scheduled 180-day retention cleanup.
GRANT SELECT, INSERT, UPDATE ON TABLE
	"User"
TO auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
	"AuthIdentity",
	"PasswordCredential",
	"AuthSession",
	"OAuthTransaction",
	"AuthToken"
TO auth_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE
	"AuthEvent"
TO auth_runtime;

-- NestJS: application/project/resource tables plus read-only canonical user
-- data. Never PasswordCredential or the other auth-domain tables.
GRANT SELECT ON TABLE
	"User"
TO backend_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
	"Notification",
	"ProjectMember",
	"Project",
	"TaskCategory",
	"TaskAssignee",
	"Task",
	"CalendarCategory",
	"CalendarAssignee",
	"CalendarEvent",
	"DiscoveryBlock",
	"DiscoveryBlockItem",
	"EvaluationChecklistItem"
TO backend_runtime;

-- Defense in depth: even if a blanket grant sneaks in later, keep the
-- password store out of the application role.
REVOKE ALL ON TABLE "PasswordCredential" FROM backend_runtime;
