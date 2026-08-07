import assert from "node:assert/strict";
import https from "node:https";
import test from "node:test";
import { io } from "socket.io-client";

const run = process.env.RUN_WEBSOCKET_E2E === "1";
const baseUrl = process.env.WEBSOCKET_E2E_URL ?? "http://nginx:8080";
const configuredSocketUrl =
  process.env.WEBSOCKET_E2E_SOCKET_URL ?? `${baseUrl}/ws`;
const appOrigin = process.env.WEBSOCKET_E2E_ORIGIN ?? "http://localhost:8080";
const usesTLS = new URL(baseUrl).protocol === "https:";
const ingressHost = process.env.WEBSOCKET_E2E_INGRESS_HOST ?? "localhost";
const tlsServerName = process.env.WEBSOCKET_E2E_TLS_SERVER_NAME ?? ingressHost;

function realtimeServerOrigin(socketUrl, expectedOrigin) {
  const parsed = new URL(socketUrl, expectedOrigin);
  return parsed.origin.replace(/^http/, "ws");
}

test("keeps the configured /ws path out of the Socket.IO namespace", () => {
  assert.equal(
    realtimeServerOrigin("ws://localhost:8080/ws", appOrigin),
    "ws://localhost:8080"
  );
});

test(
  "enforces ticket-only websocket admission and sid revocation",
  { skip: !run, timeout: 50_000 },
  async () => {
    const login = await e2eFetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: appOrigin,
      },
      body: JSON.stringify({
        email: process.env.WEBSOCKET_E2E_EMAIL ?? "andrei@42.fr",
        password: process.env.WEBSOCKET_E2E_PASSWORD ?? "SeedPassword123!",
      }),
    });
    await assertStatus(login, 200);
    const cookies = login.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ");
    const session = await login.json();
    assert.equal(typeof session.accessToken, "string");
    assert.equal(typeof session.csrfToken, "string");

    const ticket = await issueTicket(session.accessToken);
    const primary = await connect({ ticket, origin: appOrigin });
    await expectRejected({ ticket, origin: appOrigin });

    const resource = await firstChecklistItem(session.accessToken);
    const acquired = await primary.timeout(5_000).emitWithAck("field:lock", {
      projectId: resource.projectId,
      key: `checklist-item:${resource.itemId}`,
    });
    assert.equal(acquired.locked, true);
    assert.equal(typeof acquired.leaseToken, "string");
    const queried = await primary.timeout(5_000).emitWithAck("field:query", {
      projectId: resource.projectId,
      key: `checklist-item:${resource.itemId}`,
    });
    assert.equal(queried.lock?.socketId, primary.id);
    primary.emit("field:unlock", {
      projectId: resource.projectId,
      key: `checklist-item:${resource.itemId}`,
    });

    const originTicket = await issueTicket(session.accessToken);
    await expectRejected({
      ticket: originTicket,
      origin: "http://evil.example",
    });
    const originChecked = await connect({
      ticket: originTicket,
      origin: appOrigin,
    });
    originChecked.disconnect();

    await expectRejected({
      query: { accessToken: session.accessToken },
      origin: appOrigin,
      cookie: cookies,
    });

    const disconnected = waitForDisconnect(primary);
    const logout = await e2eFetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: cookies,
        Origin: appOrigin,
        "X-CSRF-Token": session.csrfToken,
      },
    });
    await assertStatus(logout, 204);
    await disconnected;

    const inactive = await e2eFetch(`${baseUrl}/auth/ws-ticket`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.accessToken,
        Origin: appOrigin,
      },
    });
    assert.equal(inactive.status, 401);
    primary.disconnect();
  }
);

async function issueTicket(accessToken) {
  const response = await e2eFetch(`${baseUrl}/auth/ws-ticket`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      Origin: appOrigin,
    },
  });
  await assertStatus(response, 201);
  const payload = await response.json();
  assert.match(payload.ticket, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(payload.expiresIn, 60);
  return payload.ticket;
}

async function firstChecklistItem(accessToken) {
  const projectsResponse = await e2eFetch(`${baseUrl}/api/projects`, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  await assertStatus(projectsResponse, 200);
  const projects = await projectsResponse.json();
  assert.ok(Array.isArray(projects));

  for (const project of projects) {
    if (!project || typeof project.id !== "string") {
      continue;
    }
    const itemsResponse = await e2eFetch(
      `${baseUrl}/api/projects/${project.id}/evaluation-checklist-items`,
      { headers: { Authorization: "Bearer " + accessToken } }
    );
    await assertStatus(itemsResponse, 200);
    const items = await itemsResponse.json();
    if (Array.isArray(items) && items[0] && typeof items[0].id === "string") {
      return { projectId: project.id, itemId: items[0].id };
    }
  }
  assert.fail("expected a seeded checklist item");
}

function e2eFetch(url, options = {}) {
  if (!usesTLS) {
    return fetch(url, options);
  }
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: options.method ?? "GET",
        headers: { ...options.headers, Host: ingressHost },
        servername: tlsServerName,
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          resolve({
            status: response.statusCode ?? 0,
            headers: {
              getSetCookie: () => response.headers["set-cookie"] ?? [],
            },
            json: async () => JSON.parse(body),
            text: async () => body,
          });
        });
      }
    );
    request.once("error", reject);
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

function connect({ ticket, query, origin, cookie }) {
  return new Promise((resolve, reject) => {
    const socket = io(realtimeServerOrigin(configuredSocketUrl, baseUrl), {
      path: "/ws",
      transports: ["websocket"],
      reconnection: false,
      timeout: 5_000,
      query: query ?? { ticket },
      extraHeaders: {
        ...(usesTLS ? { Host: ingressHost } : {}),
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(usesTLS
        ? { rejectUnauthorized: false, servername: tlsServerName }
        : {}),
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => {
      socket.disconnect();
      reject(error);
    });
  });
}

async function expectRejected(options) {
  await assert.rejects(connect(options));
}

function waitForDisconnect(socket) {
  if (!socket.connected) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("socket remained connected after session revocation"));
    }, 35_000);
    socket.once("disconnect", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function assertStatus(response, expected) {
  if (response.status !== expected) {
    assert.fail(
      `expected HTTP ${expected}, received ${response.status}: ${await response.text()}`
    );
  }
}
