import assert from "node:assert/strict";
import test from "node:test";
import { setNoStoreForSensitiveApi } from "../src/common/no-store-sensitive-api";

function applyMiddleware(path: string): {
  cacheControl: string | undefined;
  nextCalls: number;
} {
  let cacheControl: string | undefined;
  let nextCalls = 0;
  setNoStoreForSensitiveApi(
    { path } as never,
    {
      setHeader: (name: string, value: string) => {
        if (name === "Cache-Control") {
          cacheControl = value;
        }
      },
    } as never,
    () => {
      nextCalls += 1;
    }
  );
  return { cacheControl, nextCalls };
}

test("sets no-store before guards for sensitive API namespaces", () => {
  assert.equal(
    applyMiddleware("/api/public/v1/projects/project-id/tasks").cacheControl,
    "no-store"
  );
  assert.equal(
    applyMiddleware("/api/projects/project-id/api-tokens/token-id/revoke")
      .cacheControl,
    "no-store"
  );
});

test("does not set no-store for unrelated API routes", () => {
  assert.equal(
    applyMiddleware("/api/projects/project-id/tasks").cacheControl,
    undefined
  );
});

test("passes every request to subsequent middleware", () => {
  assert.equal(applyMiddleware("/api/projects/project-id/tasks").nextCalls, 1);
});
