import assert from "node:assert/strict";
import test from "node:test";

const initialSession = session("access-1");
const refreshedSession = session("access-2");

test("background bearer refresh synchronizes AuthSessionResource", async () => {
  installBrowserGlobals([
    response(401),
    response(200, refreshedSession),
    response(200),
  ]);
  const { authSessionResource } = await import("../dist-test/lib/authState.js");
  const { bearerFetch } = await import("../dist-test/lib/apiClient.js");

  authSessionResource.setAuthenticated(initialSession);
  const result = await bearerFetch("/api/projects");

  assert.equal(result.status, 200);
  assert.deepEqual(authSessionResource.getState(), {
    status: "authenticated",
    session: refreshedSession,
  });
});

test("failed background refresh synchronizes anonymous state", async () => {
  installBrowserGlobals([response(401), response(401)]);
  const { authSessionResource } = await import("../dist-test/lib/authState.js");
  const { bearerFetch } = await import("../dist-test/lib/apiClient.js");

  authSessionResource.setAuthenticated(initialSession);
  const result = await bearerFetch("/api/projects");

  assert.equal(result.status, 401);
  assert.deepEqual(authSessionResource.getState(), { status: "anonymous" });
});

test("background refresh transport failure synchronizes anonymous state", async () => {
  installBrowserGlobals([response(401), new Error("network unavailable")]);
  const { authSessionResource } = await import("../dist-test/lib/authState.js");
  const { bearerFetch } = await import("../dist-test/lib/apiClient.js");

  authSessionResource.setAuthenticated(initialSession);
  await assert.rejects(bearerFetch("/api/projects"), /network unavailable/);

  assert.deepEqual(authSessionResource.getState(), { status: "anonymous" });
});

test("background auth publications update the realtime lifecycle", async () => {
  installBrowserGlobals([]);
  const { setAuthSession } = await import("../dist-test/lib/auth.js");
  const { AuthSessionResource } = await import("../dist-test/lib/authState.js");
  let resets = 0;
  let disconnects = 0;
  const resource = new AuthSessionResource({
    reset: () => {
      resets += 1;
    },
    disconnect: () => {
      disconnects += 1;
    },
  });

  resource.setAuthenticated(initialSession);
  setAuthSession(refreshedSession);
  assert.equal(resets, 1);

  setAuthSession(null);
  assert.equal(disconnects, 1);
  assert.deepEqual(resource.getState(), { status: "anonymous" });
});

test("bearerFetch rejects cross-origin URLs before attaching a bearer", async () => {
  let called = false;
  installBrowserGlobals([]);
  globalThis.fetch = async () => {
    called = true;
    return response(200);
  };
  const { bearerFetch } = await import("../dist-test/lib/apiClient.js");

  await assert.rejects(
    bearerFetch("https://objects.example/upload"),
    /same-origin/
  );
  assert.equal(called, false);
});

function installBrowserGlobals(responses) {
  globalThis.window = {
    location: {
      href: "http://localhost/dashboard",
      origin: "http://localhost",
    },
  };
  globalThis.document = { cookie: "tr_csrf=csrf-token" };
  globalThis.fetch = async () => {
    const next = responses.shift();
    assert.ok(next, "unexpected fetch call");
    if (next instanceof Error) {
      throw next;
    }
    return next;
  };
}

function response(status, body) {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
  });
}

function session(accessToken) {
  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn: 900,
    user: {
      id: "user-1",
      email: "user@example.com",
      emailVerified: true,
      username: "rabbit",
      avatarUrl: null,
      campus: null,
    },
    csrfToken: "csrf-token",
    idleExpiresAt: "2026-08-10T00:00:00.000Z",
    absoluteExpiresAt: "2026-09-01T00:00:00.000Z",
  };
}
