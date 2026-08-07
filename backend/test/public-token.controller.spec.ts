import assert from "node:assert/strict";
import test from "node:test";
import { PublicTokenController } from "../src/public-api/public-token.controller";

test("returns non-secret metadata for the authenticated project API token", () => {
  const response = new PublicTokenController().introspect({
    apiToken: {
      principalType: "PROJECT_API_TOKEN",
      tokenId: "83ea58d2-33e5-4d2e-8396-5e3418d2bb1f",
      projectId: "dd222ec4-4f94-449c-a50d-1c7cab1b60fd",
      label: "release automation",
      permission: "READ_WRITE",
      expiresAt: "2026-12-31T00:00:00.000Z",
      lastUsedAt: "2026-08-07T00:00:00.000Z",
    },
  } as never);

  assert.deepEqual(response, {
    id: "83ea58d2-33e5-4d2e-8396-5e3418d2bb1f",
    projectId: "dd222ec4-4f94-449c-a50d-1c7cab1b60fd",
    label: "release automation",
    permission: "READ_WRITE",
    expiresAt: "2026-12-31T00:00:00.000Z",
    lastUsedAt: "2026-08-07T00:00:00.000Z",
    status: "ACTIVE",
  });
});
