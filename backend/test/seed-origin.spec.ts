import assert from "node:assert/strict";
import test from "node:test";
import { seedRequestOrigin } from "../prisma/seed/register-user";

test("replaces a wildcard hostname with a concrete seed hostname", () => {
  assert.equal(
    seedRequestOrigin("https://*.paris.42.school:8443"),
    "https://seed.paris.42.school:8443"
  );
});

test("preserves a concrete configured Origin", () => {
  assert.equal(
    seedRequestOrigin("https://tomato.iops.dev"),
    "https://tomato.iops.dev"
  );
});
