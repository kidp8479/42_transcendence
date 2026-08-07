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
	"RefreshTokenFamily",
	"AuthRefreshToken",
	"WebSocketTicket",
	"AuthToken",
	"ProjectApiToken"
TO auth_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE
	"AuthEvent",
	"ProjectApiTokenEvent"
TO auth_runtime;
-- Auth creates project-bound credentials, but cannot read or mutate project
-- data. REFERENCES is the minimum privilege PostgreSQL requires to enforce
-- the ProjectApiToken foreign key during INSERT.
GRANT REFERENCES ("id") ON TABLE "Project" TO auth_runtime;

-- NestJS: application/project/resource tables plus canonical user data.
-- Read access to the full row, but write access only to the self-service
-- profile columns (PATCH /users/me) - identity fields (email, emailVerified)
-- stay exclusively writable by auth_runtime. Never PasswordCredential or the
-- other auth-domain tables.
GRANT SELECT ON TABLE
	"User"
TO backend_runtime;
-- includes updatedAt: Prisma's @updatedAt sets it on every generated UPDATE,
-- so it must be grantable even though callers never set it explicitly.
GRANT UPDATE (
	"username",
	"avatarUrl",
	"campus",
	"updatedAt"
) ON TABLE
	"User"
TO backend_runtime;
-- grant self account deletion to user
GRANT DELETE ON TABLE
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
	"EvaluationChecklistItem",
	"ChatMessage",
	"ChatReadState",
	"UserRelationship"
TO backend_runtime;

-- Defense in depth: even if a blanket grant sneaks in later, keep the
-- auth/security store out of the application role.
REVOKE ALL ON TABLE
	"PasswordCredential",
	"AuthIdentity",
	"AuthSession",
	"OAuthTransaction",
	"RefreshTokenFamily",
	"AuthRefreshToken",
	"WebSocketTicket",
	"AuthToken",
	"AuthEvent",
	"ProjectApiToken",
	"ProjectApiTokenEvent",
	"MachineTaskActionAudit"
FROM backend_runtime;
-- Machine task-action evidence is append-only and is written without a
-- RETURNING clause, so the application needs INSERT but never read/update/
-- delete access to it.
GRANT INSERT ON TABLE "MachineTaskActionAudit" TO backend_runtime;
