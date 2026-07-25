import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { URL } from "node:url";
import {
  DatabaseCredentials,
  VaultClient,
} from "../src/vault/vault.client";

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

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function readProtectedIDFile(path: string, label: string): Promise<string> {
  const info = await stat(path);
  if ((info.mode & 0o077) !== 0) {
    throw new Error(`Vault ${label} file permissions are too broad`);
  }
  const value = (await readFile(path, "utf8")).trim();
  if (!value) {
    throw new Error(`Vault ${label} file is empty`);
  }
  return value;
}

function buildDatabaseUrl(
  host: string,
  port: string,
  database: string,
  credentials: DatabaseCredentials
): string {
  const url = new URL(`postgresql://${host}:${port}`);
  url.pathname = database;
  url.username = credentials.username;
  url.password = credentials.password;
  url.searchParams.set("sslmode", "disable");
  return url.toString();
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
