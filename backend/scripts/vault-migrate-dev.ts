import { spawn } from "node:child_process";
import { VaultClient } from "../src/vault/vault.client";
import {
  buildDatabaseUrl,
  readProtectedIDFile,
  requiredEnv,
} from "./vault-prisma-utils";

async function main(): Promise<void> {
  const client = new VaultClient(requiredEnv("VAULT_ADDR").replace(/\/$/, ""));
  const [roleId, secretId] = await Promise.all([
    readProtectedIDFile(requiredEnv("VAULT_ROLE_ID_FILE"), "Role ID"),
    readProtectedIDFile(requiredEnv("VAULT_SECRET_ID_FILE"), "Secret ID"),
  ]);
  await client.login(roleId, secretId);
  const credentials = await client.issueDatabaseCredentials(
    requiredEnv("VAULT_DB_ROLE")
  );
  await runPrismaMigrateDev(
    buildDatabaseUrl(
      requiredEnv("VAULT_DB_HOST"),
      requiredEnv("VAULT_DB_PORT"),
      requiredEnv("VAULT_DB_NAME"),
      credentials
    ),
    requiredMigrationName()
  );
}

function requiredMigrationName(): string {
  const name = requiredEnv("PRISMA_MIGRATION_NAME");
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(name)) {
    throw new Error(
      "PRISMA_MIGRATION_NAME must use lowercase letters, digits, hyphens, or underscores"
    );
  }
  return name;
}

function runPrismaMigrateDev(
  databaseUrl: string,
  migrationName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = spawn(
      "npx",
      ["prisma", "migrate", "dev", "--name", migrationName],
      {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: databaseUrl },
      }
    );
    command.once("error", reject);
    command.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`prisma migrate dev exited with code ${code}`));
    });
  });
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "migration authoring failed"
  );
  process.exitCode = 1;
});
