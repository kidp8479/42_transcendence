import assert from "node:assert/strict";
import test from "node:test";
import { AuthGuard } from "../src/auth/auth.guard";
import { PROJECT_API_TOKEN_SELF_KEY } from "../src/auth/project-api-token.constants";

test("defers self-reflection routes to project API token authentication", async () => {
  const guard = new AuthGuard(
    {
      getAllAndOverride: (key: string) =>
        key === PROJECT_API_TOKEN_SELF_KEY ? true : undefined,
    } as never,
    { getOrThrow: () => "http://auth" } as never,
    {} as never
  );
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  };

  assert.equal(await guard.canActivate(context as never), true);
});
