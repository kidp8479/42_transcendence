import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "../src/health/health.controller";
import { PrismaService } from "../src/prisma/prisma.service";
import { VaultRuntimeService } from "../src/vault/vault-runtime.service";

function healthController({
  vaultReady = true,
  databaseReady = true,
}: {
  vaultReady?: boolean;
  databaseReady?: boolean;
} = {}): HealthController {
  return new HealthController(
    { isReady: () => vaultReady } as VaultRuntimeService,
    {
      ping: async () => {
        if (!databaseReady) {
          throw new Error("database unavailable");
        }
      },
    } as PrismaService
  );
}

test("reports ready only when Vault and the database are available", async () => {
  assert.deepEqual(await healthController().getHealth(), { status: "ok" });
});

test("does not disclose the unavailable dependency", async () => {
  for (const options of [{ vaultReady: false }, { databaseReady: false }]) {
    await assert.rejects(
      healthController(options).getHealth(),
      (error: unknown) =>
        error instanceof ServiceUnavailableException &&
        JSON.stringify(error.getResponse()) ===
          JSON.stringify({ status: "unavailable" })
    );
  }
});
