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
  await runPrismaMigrate(
    buildDatabaseUrl(
      requiredEnv("VAULT_DB_HOST"),
      requiredEnv("VAULT_DB_PORT"),
      requiredEnv("VAULT_DB_NAME"),
      credentials
    )
  );
}

function runPrismaMigrate(databaseUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    command.once("error", reject);
    command.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`prisma migrate deploy exited with code ${code}`));
    });
  });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "migration failed");
  process.exitCode = 1;
});
