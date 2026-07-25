import { PrismaClient } from "@prisma/client";
import { DatabaseCredentials, VaultClient } from "../src/vault/vault.client";
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
  return new PrismaClient({
    datasources: {
      db: {
        url: buildDatabaseUrl(
          requiredEnv("VAULT_DB_HOST"),
          requiredEnv("VAULT_DB_PORT"),
          requiredEnv("VAULT_DB_NAME"),
          credentials
        ),
      },
    },
  });
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Vault Prisma rotation failed"
  );
  process.exitCode = 1;
});
