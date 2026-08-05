import assert from "node:assert/strict";
import test from "node:test";
import { setNoStoreForSensitiveApi } from "../src/common/no-store-sensitive-api";

function cacheControlFor(path: string): string | undefined {
  let cacheControl: string | undefined;
  setNoStoreForSensitiveApi(
    { path } as never,
    {
      setHeader: (name: string, value: string) => {
        if (name === "Cache-Control") {
          cacheControl = value;
        }
      },
    } as never
  );
  return cacheControl;
}

test("sets no-store before guards for sensitive API namespaces", () => {
  assert.equal(
    cacheControlFor("/api/public/v1/projects/project-id/tasks"),
    "no-store"
  );
  assert.equal(
    cacheControlFor("/api/projects/project-id/api-tokens/token-id/revoke"),
    "no-store"
  );
});

test("does not set no-store for unrelated API routes", () => {
  assert.equal(cacheControlFor("/api/projects/project-id/tasks"), undefined);
});
