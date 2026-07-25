import { readFile, stat } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
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

  const firstCredentials = await client.issueDatabaseCredentials(
    requiredEnv("VAULT_DB_ROLE")
  );
  const firstClient = newPrismaClient(firstCredentials);
  await firstClient.$connect();
  await firstClient.user.count();

  const replacementCredentials = await client.issueDatabaseCredentials(
    requiredEnv("VAULT_DB_ROLE")
  );
  const replacementClient = newPrismaClient(replacementCredentials);
  await replacementClient.$connect();
  await replacementClient.user.count();

  // This mirrors PrismaService: publish a verified replacement before the
  // prior pool is drained, so new calls never receive stale credentials.
  await firstClient.$disconnect();
  await replacementClient.$disconnect();
  console.log("Vault Prisma credential rotation check passed");
}

function newPrismaClient(credentials: DatabaseCredentials): PrismaClient {
  const url = new URL(
    `postgresql://${requiredEnv("VAULT_DB_HOST")}:${requiredEnv("VAULT_DB_PORT")}`
  );
  url.pathname = requiredEnv("VAULT_DB_NAME");
  url.username = credentials.username;
  url.password = credentials.password;
  url.searchParams.set("sslmode", "disable");
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
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

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Vault Prisma rotation failed"
  );
  process.exitCode = 1;
});
