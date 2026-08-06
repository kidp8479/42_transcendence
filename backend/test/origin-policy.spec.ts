import assert from "node:assert/strict";
import test from "node:test";
import { allowsBrowserOrigin } from "../src/security/origin-policy";

test("allows exact local and public browser origins", () => {
  assert.equal(
    allowsBrowserOrigin("https://localhost:8443", "https://localhost:8443"),
    true
  );
  assert.equal(
    allowsBrowserOrigin(
      "https://tomato.iops.dev",
      "https://tomato-dev.iops.dev"
    ),
    false
  );
});

test("allows only one school hostname label on port 8443", () => {
  const configuredOrigin = "https://*.paris.42.school:8443";

  assert.equal(
    allowsBrowserOrigin(
      configuredOrigin,
      "https://f6r13s1.paris.42.school:8443"
    ),
    true
  );
  assert.equal(
    allowsBrowserOrigin(
      configuredOrigin,
      "https://lab.f6r13s1.paris.42.school:8443"
    ),
    false
  );
  assert.equal(
    allowsBrowserOrigin(
      configuredOrigin,
      "https://f6r13s1.paris.42.school:443"
    ),
    false
  );
  assert.equal(
    allowsBrowserOrigin(
      configuredOrigin,
      "https://f6r13s1.paris.42.school.evil.example:8443"
    ),
    false
  );
});

test("only the school value enables wildcard matching", () => {
  assert.equal(
    allowsBrowserOrigin("https://*.example.test", "https://api.example.test"),
    false
  );
});
