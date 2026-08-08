import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "../src/health/health.controller";
import { PrismaService } from "../src/prisma/prisma.service";
import { StorageService } from "../src/storage/storage.service";
import { VaultRuntimeService } from "../src/vault/vault-runtime.service";

function healthController({
  vaultReady = true,
  databaseReady = true,
  storageReady = true,
}: {
  vaultReady?: boolean;
  databaseReady?: boolean;
  storageReady?: boolean;
} = {}): HealthController {
  return new HealthController(
    { isReady: () => vaultReady } as VaultRuntimeService,
    {
      ping: async () => {
        if (!databaseReady) {
          throw new Error("database unavailable");
        }
      },
    } as PrismaService,
    {
      ping: async () => {
        if (!storageReady) {
          throw new Error("storage unavailable");
        }
      },
    } as StorageService
  );
}

test("reports ready only when Vault and the database are available", async () => {
  assert.deepEqual(await healthController().getHealth(), { status: "ok" });
});

test("reports attachment storage readiness separately", async () => {
  assert.deepEqual(await healthController().getStorageHealth(), {
    status: "ok",
  });
});

test("does not disclose the unavailable dependency", async () => {
  for (const [method, options] of [
    ["getHealth", { vaultReady: false }],
    ["getHealth", { databaseReady: false }],
    ["getStorageHealth", { storageReady: false }],
  ] as const) {
    await assert.rejects(
      healthController(options)[method](),
      (error: unknown) =>
        error instanceof ServiceUnavailableException &&
        JSON.stringify(error.getResponse()) ===
          JSON.stringify({ status: "unavailable" })
    );
  }
});
