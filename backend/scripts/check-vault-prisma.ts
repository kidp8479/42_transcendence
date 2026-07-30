import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { DatabaseCredentials, VaultClient } from "../src/vault/vault.client";
import {
  buildDatabaseUrl,
  readProtectedIDFile,
  requiredEnv,
} from "./vault-prisma-utils";

const backendDirectory = resolve(__dirname, "..");
const prismaDirectory = join(backendDirectory, "prisma");
const migrationsDirectory = join(prismaDirectory, "migrations");
const schemaPath = join(prismaDirectory, "schema.prisma");
const tr69Migration = "20260725230801_tr69_auth_persistence_expand";
const ownerlessProjectError =
  "Cannot assign an OWNER to a project with no members";
const authOnlyTables = [
  "AuthIdentity",
  "PasswordCredential",
  "AuthSession",
  "OAuthTransaction",
  "RefreshTokenFamily",
  "AuthRefreshToken",
  "WebSocketTicket",
  "AuthToken",
  "AuthEvent",
];

type RuntimeCredentialPrefix = "AUTH" | "BACKEND" | "MIGRATION";

interface OwnerRow {
  projectId: string;
  userId: string;
}

class PrismaCommandError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number | null,
    readonly output: string
  ) {
    super(`${command} exited with code ${exitCode}\n${output}`);
  }
}

async function main(): Promise<void> {
  await verifyBackendCredentialRotation();
  console.log("Vault Prisma credential rotation check passed");

  await verifyRuntimeGrants();
  console.log("Vault runtime database grants check passed");

  await verifyTr69Migration();
  console.log("TR-69 migration validation passed");
}

async function verifyBackendCredentialRotation(): Promise<void> {
  const vaultClient = await newVaultClient("BACKEND");
  let firstClient: PrismaClient | undefined;
  let replacementClient: PrismaClient | undefined;
  let validationError: unknown;

  try {
    firstClient = newPrismaClient(
      await vaultClient.issueDatabaseCredentials("backend-runtime")
    );
    await firstClient.$connect();
    await firstClient.user.count();

    replacementClient = newPrismaClient(
      await vaultClient.issueDatabaseCredentials("backend-runtime")
    );
    await replacementClient.$connect();
    await replacementClient.user.count();
  } catch (error: unknown) {
    validationError = error;
  }

  const cleanupErrors: unknown[] = [];
  for (const client of [firstClient, replacementClient]) {
    if (!client) {
      continue;
    }
    try {
      // This mirrors PrismaService: publish a verified replacement before the
      // prior pool is drained, so new calls never receive stale credentials.
      await client.$disconnect();
    } catch (error: unknown) {
      cleanupErrors.push(error);
    }
  }

  const error = combineErrors(
    validationError,
    cleanupErrors,
    "Vault Prisma rotation cleanup failed",
    "Vault Prisma rotation validation and cleanup failed"
  );
  if (error) {
    throw error;
  }
}

async function verifyRuntimeGrants(): Promise<void> {
  const [authClient, backendClient] = await Promise.all([
    newRuntimeClient("auth-runtime", "AUTH"),
    newRuntimeClient("backend-runtime", "BACKEND"),
  ]);

  try {
    await verifyAuthRuntime(authClient);
    await verifyBackendRuntime(backendClient);
  } finally {
    await Promise.all([authClient.$disconnect(), backendClient.$disconnect()]);
  }
}

async function newRuntimeClient(
  vaultRole: string,
  environmentPrefix: RuntimeCredentialPrefix
): Promise<PrismaClient> {
  const client = await newVaultClient(environmentPrefix);
  const credentials = await client.issueDatabaseCredentials(vaultRole);
  const database = newPrismaClient(credentials);
  await database.$connect();
  return database;
}

async function newVaultClient(
  environmentPrefix: RuntimeCredentialPrefix
): Promise<VaultClient> {
  const client = new VaultClient(requiredEnv("VAULT_ADDR").replace(/\/$/, ""));
  const [roleId, secretId] = await Promise.all([
    readProtectedIDFile(
      requiredEnv(`${environmentPrefix}_VAULT_ROLE_ID_FILE`),
      `${environmentPrefix.toLowerCase()} Role ID`
    ),
    readProtectedIDFile(
      requiredEnv(`${environmentPrefix}_VAULT_SECRET_ID_FILE`),
      `${environmentPrefix.toLowerCase()} Secret ID`
    ),
  ]);
  await client.login(roleId, secretId);
  return client;
}

function newPrismaClient(
  credentials: DatabaseCredentials,
  database = requiredEnv("VAULT_DB_NAME")
): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: buildDatabaseUrl(
          requiredEnv("VAULT_DB_HOST"),
          requiredEnv("VAULT_DB_PORT"),
          database,
          credentials
        ),
      },
    },
  });
}

async function verifyAuthRuntime(client: PrismaClient): Promise<void> {
  for (const table of ["User", ...authOnlyTables]) {
    await client.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
  }

  const eventId = randomUUID();
  await client.$executeRawUnsafe(
    `INSERT INTO "AuthEvent" ("id", "eventType", "createdAt")
     VALUES ($1, 'VAULT_GRANT_CHECK', CURRENT_TIMESTAMP)`,
    eventId
  );

  try {
    await expectDenied(
      () =>
        client.$executeRawUnsafe(
          `UPDATE "AuthEvent" SET "reason" = 'must remain immutable' WHERE "id" = $1`,
          eventId
        ),
      "auth_runtime must not update AuthEvent"
    );
    await expectDenied(
      () =>
        client.$executeRawUnsafe(
          `CREATE TABLE vault_runtime_grant_probe_${eventId.replaceAll("-", "")} (id integer)`
        ),
      "auth_runtime must not run DDL"
    );
  } finally {
    await client.$executeRawUnsafe(
      `DELETE FROM "AuthEvent" WHERE "id" = $1`,
      eventId
    );
  }
}

async function verifyBackendRuntime(client: PrismaClient): Promise<void> {
  await client.$queryRawUnsafe(`SELECT 1 FROM "User" LIMIT 1`);

  for (const table of authOnlyTables) {
    await expectDenied(
      () => client.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`),
      `backend_runtime must not read ${table}`
    );
  }
}

async function expectDenied(
  operation: () => Promise<unknown>,
  description: string
): Promise<void> {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(description);
}

async function verifyTr69Migration(): Promise<void> {
  const vaultClient = await newVaultClient("MIGRATION");
  const credentials = await vaultClient.issueDatabaseCredentials("migration");
  const databaseUrl = (database: string): string =>
    buildDatabaseUrl(
      requiredEnv("VAULT_DB_HOST"),
      requiredEnv("VAULT_DB_PORT"),
      database,
      credentials
    );

  let workspace: string | undefined;
  let managementClient: PrismaClient | undefined;
  let validationError: unknown;

  try {
    workspace = await createPreTr69MigrationWorkspace();
    managementClient = new PrismaClient({
      datasources: { db: { url: databaseUrl("postgres") } },
    });
    await managementClient.$connect();

    await withTemporaryDatabase(managementClient, databaseUrl, async (url) => {
      await runPrismaMigrate(url, join(workspace, "prisma.config.ts"));
      await withPrismaClient(url, seedValidPreTr69Fixtures);
      await runPrismaMigrate(url);
      await withPrismaClient(url, assertValidFixtureUpgrade);
    });

    await withTemporaryDatabase(managementClient, databaseUrl, async (url) => {
      await runPrismaMigrate(url, join(workspace, "prisma.config.ts"));
      await withPrismaClient(url, seedOwnerlessPreTr69Fixture);
      await assertOwnerlessUpgradeFails(url);
    });
  } catch (error: unknown) {
    validationError = error;
  }

  const cleanupErrors: unknown[] = [];
  if (managementClient) {
    try {
      await managementClient.$disconnect();
    } catch (error: unknown) {
      cleanupErrors.push(error);
    }
  }
  if (workspace) {
    try {
      await rm(workspace, { recursive: true, force: false });
    } catch (error: unknown) {
      cleanupErrors.push(error);
    }
  }

  const error = combineErrors(validationError, cleanupErrors);
  if (error) {
    throw error;
  }
}

async function createPreTr69MigrationWorkspace(): Promise<string> {
  const workspace = join(
    backendDirectory,
    `.tr69-migration-check-${randomUUID()}`
  );
  try {
    const workspaceMigrations = join(workspace, "migrations");
    await mkdir(workspaceMigrations, { recursive: true });
    await cp(schemaPath, join(workspace, "schema.prisma"));
    await cp(
      join(migrationsDirectory, "migration_lock.toml"),
      join(workspaceMigrations, "migration_lock.toml")
    );
    await writeFile(
      join(workspace, "prisma.config.ts"),
      `import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: ${JSON.stringify(join(workspace, "schema.prisma"))},
  migrations: { path: ${JSON.stringify(workspaceMigrations)} },
  datasource: { url: process.env.DATABASE_URL },
});
`
    );

    const migrations = await readdir(migrationsDirectory, {
      withFileTypes: true,
    });
    await Promise.all(
      migrations
        .filter(
          (entry) =>
            entry.isDirectory() && entry.name.localeCompare(tr69Migration) < 0
        )
        .map((entry) =>
          cp(
            join(migrationsDirectory, entry.name),
            join(workspaceMigrations, entry.name),
            { recursive: true }
          )
        )
    );
    return workspace;
  } catch (error: unknown) {
    const cleanupErrors: unknown[] = [];
    try {
      await rm(workspace, { recursive: true, force: true });
    } catch (cleanupError: unknown) {
      cleanupErrors.push(cleanupError);
    }
    throw combineErrors(error, cleanupErrors);
  }
}

async function withTemporaryDatabase<T>(
  managementClient: PrismaClient,
  databaseUrl: (database: string) => string,
  task: (url: string) => Promise<T>
): Promise<T> {
  const database = `tr69_check_${randomUUID().replaceAll("-", "")}`;
  let databaseCreated = false;
  let taskError: unknown;
  let result: T | undefined;

  try {
    await managementClient.$executeRawUnsafe(
      `CREATE DATABASE ${quoteIdentifier(database)}`
    );
    databaseCreated = true;
    result = await task(databaseUrl(database));
  } catch (error: unknown) {
    taskError = error;
  }

  const cleanupErrors: unknown[] = [];
  if (databaseCreated) {
    try {
      await managementClient.$executeRawUnsafe(
        `DROP DATABASE ${quoteIdentifier(database)} WITH (FORCE)`
      );
    } catch (error: unknown) {
      cleanupErrors.push(
        new Error(
          `Failed to drop temporary database ${database}: ${formatError(error)}`
        )
      );
    }
  }

  const error = combineErrors(taskError, cleanupErrors);
  if (error) {
    throw error;
  }
  return result as T;
}

async function withPrismaClient<T>(
  databaseUrl: string,
  task: (client: PrismaClient) => Promise<T>
): Promise<T> {
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  let taskError: unknown;
  let result: T | undefined;

  try {
    await client.$connect();
    result = await task(client);
  } catch (error: unknown) {
    taskError = error;
  }

  const cleanupErrors: unknown[] = [];
  try {
    await client.$disconnect();
  } catch (error: unknown) {
    cleanupErrors.push(error);
  }

  const error = combineErrors(taskError, cleanupErrors);
  if (error) {
    throw error;
  }
  return result as T;
}

async function seedValidPreTr69Fixtures(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe(`
    INSERT INTO "User" ("id", "email", "username", "createdAt", "updatedAt")
    VALUES
      ('valid-admin-oldest', 'valid-admin-oldest@example.test', 'adminoldest', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
      ('valid-admin-newest', 'valid-admin-newest@example.test', 'adminnewest', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
      ('valid-member-earliest', 'valid-member-earliest@example.test', 'memberearliest', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
      ('valid-member-oldest', 'valid-member-oldest@example.test', 'memberoldest', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
      ('valid-member-newest', 'valid-member-newest@example.test', 'membernewest', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "Project" ("id", "name", "createdAt", "updatedAt")
    VALUES
      ('project-with-admin', 'Project with admins', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
      ('project-without-admin', 'Project without admins', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "ProjectMember" ("id", "userId", "projectId", "role", "createdAt", "updatedAt")
    VALUES
      ('admin-member-oldest', 'valid-admin-oldest', 'project-with-admin', 'ADMIN', '2024-02-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z'),
      ('admin-member-newest', 'valid-admin-newest', 'project-with-admin', 'ADMIN', '2024-03-01T00:00:00.000Z', '2024-03-01T00:00:00.000Z'),
      ('admin-project-member-earliest', 'valid-member-earliest', 'project-with-admin', 'MEMBER', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
      ('member-project-member-oldest', 'valid-member-oldest', 'project-without-admin', 'MEMBER', '2024-04-01T00:00:00.000Z', '2024-04-01T00:00:00.000Z'),
      ('member-project-member-newest', 'valid-member-newest', 'project-without-admin', 'MEMBER', '2024-05-01T00:00:00.000Z', '2024-05-01T00:00:00.000Z')
  `);
}

async function assertValidFixtureUpgrade(client: PrismaClient): Promise<void> {
  const owners = await client.$queryRawUnsafe<OwnerRow[]>(`
    SELECT "projectId", "userId"
    FROM "ProjectMember"
    WHERE role = 'OWNER'
      AND "projectId" IN ('project-with-admin', 'project-without-admin')
    ORDER BY "projectId"
  `);
  const expectedOwners: OwnerRow[] = [
    { projectId: "project-with-admin", userId: "valid-admin-oldest" },
    { projectId: "project-without-admin", userId: "valid-member-oldest" },
  ];
  if (JSON.stringify(owners) !== JSON.stringify(expectedOwners)) {
    throw new Error(
      `Unexpected TR-69 owner backfill: ${JSON.stringify(owners)}`
    );
  }

  let secondOwnerRejected = false;
  try {
    await client.$executeRawUnsafe(`
      INSERT INTO "ProjectMember" ("id", "userId", "projectId", "role", "createdAt", "updatedAt")
      VALUES (
        'rejected-second-owner',
        'valid-admin-oldest',
        'project-without-admin',
        'OWNER',
        '2024-06-01T00:00:00.000Z',
        '2024-06-01T00:00:00.000Z'
      )
    `);
  } catch (error: unknown) {
    if (
      !/ProjectMember_projectId_owner_unique|unique constraint|Raw query failed\. Code: `?23505/i.test(
        formatError(error)
      )
    ) {
      throw new Error(
        `TR-69 rejected a second OWNER for an unexpected reason: ${formatError(error)}`
      );
    }
    secondOwnerRejected = true;
  }
  if (!secondOwnerRejected) {
    throw new Error("TR-69 allowed a second OWNER for one project");
  }
}

async function seedOwnerlessPreTr69Fixture(
  client: PrismaClient
): Promise<void> {
  await client.$executeRawUnsafe(`
    INSERT INTO "User" ("id", "email", "username", "createdAt", "updatedAt")
    VALUES ('ownerless-user', 'ownerless@example.test', 'ownerlessuser', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "Project" ("id", "name", "createdAt", "updatedAt")
    VALUES ('ownerless-project', 'Ownerless project', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')
  `);
}

async function assertOwnerlessUpgradeFails(databaseUrl: string): Promise<void> {
  try {
    await runPrismaMigrate(databaseUrl);
  } catch (error: unknown) {
    if (
      error instanceof PrismaCommandError &&
      error.output.includes(ownerlessProjectError)
    ) {
      return;
    }
    throw new Error(
      `TR-69 ownerless-project upgrade failed for an unexpected reason: ${formatError(error)}`
    );
  }
  throw new Error("TR-69 allowed a project with no members to be upgraded");
}

function runPrismaMigrate(
  databaseUrl: string,
  configPath?: string
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ["prisma", "migrate", "deploy"];
    if (configPath) {
      args.push("--config", configPath);
    }
    const command = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      args,
      {
        cwd: backendDirectory,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let output = "";
    let settled = false;
    const commandName = "prisma migrate deploy";
    const settle = (callback: () => void): void => {
      if (!settled) {
        settled = true;
        callback();
      }
    };

    command.stdout.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });
    command.stderr.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });
    command.once("error", (error: Error) => {
      settle(() => rejectPromise(error));
    });
    command.once("close", (code: number | null) => {
      settle(() => {
        if (code === 0) {
          resolvePromise();
          return;
        }
        rejectPromise(new PrismaCommandError(commandName, code, output));
      });
    });
  });
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(identifier)) {
    throw new Error(`Invalid temporary database name: ${identifier}`);
  }
  return `"${identifier}"`;
}

function combineErrors(
  primaryError: unknown,
  cleanupErrors: unknown[],
  cleanupMessage = "TR-69 cleanup failed",
  validationAndCleanupMessage = "TR-69 migration validation and cleanup failed"
): unknown | undefined {
  if (!primaryError) {
    if (cleanupErrors.length === 0) {
      return undefined;
    }
    return cleanupErrors.length === 1
      ? cleanupErrors[0]
      : new AggregateError(cleanupErrors, cleanupMessage);
  }
  if (cleanupErrors.length === 0) {
    return primaryError;
  }
  return new AggregateError(
    [primaryError, ...cleanupErrors],
    validationAndCleanupMessage
  );
}

function formatError(error: unknown): string {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.map(formatError)].join("\n");
  }
  return error instanceof Error ? error.message : String(error);
}

void main().catch((error: unknown) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
