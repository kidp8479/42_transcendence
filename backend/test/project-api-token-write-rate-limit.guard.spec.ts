import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { ProjectApiTokenWriteRateLimitGuard } from "../src/auth/project-api-token-write-rate-limit.guard";

function contextFor(tokenId: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ apiToken: { tokenId } }),
    }),
  };
}

test("machine write limit is isolated by authenticated token ID", () => {
  const guard = new ProjectApiTokenWriteRateLimitGuard();
  const first = contextFor("token-one");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    assert.equal(guard.canActivate(first as never), true);
  }
  assert.throws(
    () => guard.canActivate(first as never),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 429
  );
  assert.equal(guard.canActivate(contextFor("token-two") as never), true);
});
