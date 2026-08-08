import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../prisma/seed";
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
  const [credentials, seedPassword] = await Promise.all([
    client.issueDatabaseCredentials(requiredEnv("VAULT_DB_ROLE")),
    client.readSeedPassword(),
  ]);
  const prisma = new PrismaClient({
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
  try {
    await seedDatabase(prisma, seedPassword);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "seed failed");
  process.exitCode = 1;
});
