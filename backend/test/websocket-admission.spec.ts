import assert from "node:assert/strict";
import test from "node:test";
import { FieldLockManager } from "../src/realtime/field-lock-manager";
import { RealtimeGateway } from "../src/realtime/realtime.gateway";

const validTicket = "a".repeat(43);

function createClient(query: Record<string, string> = { ticket: validTicket }) {
  const rooms = new Set<string>();
  const client = {
    id: "socket-a",
    connected: true,
    handshake: {
      query,
      headers: {
        cookie: "tr_refresh=legacy-cookie",
        authorization: "Bearer legacy-jwt",
      },
    },
    data: {} as Record<string, unknown>,
    rooms,
    join: async (room: string) => {
      rooms.add(room);
    },
    disconnect: () => {
      client.connected = false;
    },
  };
  return client;
}

function installMiddleware(gateway: RealtimeGateway) {
  let middleware:
    ((client: unknown, next: (error?: Error) => void) => void) | undefined;
  gateway.afterInit({
    use: (handler: typeof middleware) => {
      middleware = handler;
    },
  } as never);
  assert.ok(middleware);
  return middleware;
}

function runMiddleware(
  middleware: (client: unknown, next: (error?: Error) => void) => void,
  client: unknown
): Promise<Error | undefined> {
  return new Promise((resolve) => middleware(client, resolve));
}

test("admits only a one-time ticket and populates the canonical socket identity", async () => {
  const manager = new FieldLockManager();
  const consumed: string[] = [];
  const gateway = new RealtimeGateway({} as never, manager, {
    consume: async (ticket: string) => {
      consumed.push(ticket);
      return {
        active: true as const,
        sub: "user-a",
        sid: "family-a",
        username: "Ada",
        avatarUrl: null,
      };
    },
  } as never);
  const client = createClient();

  const error = await runMiddleware(installMiddleware(gateway), client);

  assert.equal(error, undefined);
  assert.deepEqual(consumed, [validTicket]);
  assert.deepEqual(client.data, {
    userId: "user-a",
    sessionId: "family-a",
    username: "Ada",
    avatarUrl: null,
  });
  manager.onModuleDestroy();
});

test("does not fall back to refresh cookies or JWT query credentials", async () => {
  const manager = new FieldLockManager();
  let consumeCalls = 0;
  const gateway = new RealtimeGateway({} as never, manager, {
    consume: async () => {
      consumeCalls += 1;
      throw new Error("must not be called");
    },
  } as never);
  const client = createClient({ accessToken: "legacy-jwt" });

  const error = await runMiddleware(installMiddleware(gateway), client);

  assert.ok(error);
  assert.equal(consumeCalls, 0);
  assert.deepEqual(client.data, {});
  manager.onModuleDestroy();
});

test("preserves membership admission and disconnects after sid revocation", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const manager = new FieldLockManager();
  let active = true;
  const gateway = new RealtimeGateway(
    {
      projectMember: {
        findMany: async () => [{ projectId: "project-a" }],
        count: async () => 1,
      },
    } as never,
    manager,
    {
      consume: async () => {
        throw new Error("middleware already authenticated this client");
      },
      isSessionActive: async () => active,
    } as never
  );
  const client = createClient();
  Object.assign(client.data, {
    userId: "user-a",
    sessionId: "family-a",
    username: "Ada",
    avatarUrl: null,
  });

  await gateway.handleConnection(client as never);
  assert.equal(await client.data.ready, true);
  assert.equal(client.rooms.has("user:user-a"), true);
  assert.equal(client.rooms.has("project:project-a"), true);

  active = false;
  t.mock.timers.tick(30_000);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(client.connected, false);

  await gateway.handleDisconnect(client as never);
  manager.onModuleDestroy();
  t.mock.timers.reset();
});

test("disconnects when post-admission room initialization fails", async () => {
  const manager = new FieldLockManager();
  const gateway = new RealtimeGateway(
    {
      projectMember: {
        findMany: async () => {
          throw new Error("database unavailable");
        },
      },
    } as never,
    manager,
    {
      consume: async () => {
        throw new Error("middleware already authenticated this client");
      },
      isSessionActive: async () => true,
    } as never
  );
  const client = createClient();
  Object.assign(client.data, {
    userId: "user-a",
    sessionId: "family-a",
  });

  await gateway.handleConnection(client as never);

  assert.equal(await client.data.ready, false);
  assert.equal(client.connected, false);
  manager.onModuleDestroy();
});

test("limits concurrent sockets for one refresh session", async () => {
  const manager = new FieldLockManager();
  const gateway = new RealtimeGateway(
    {
      projectMember: {
        findMany: async () => [],
      },
    } as never,
    manager,
    {
      consume: async () => {
        throw new Error("middleware already authenticated this client");
      },
      isSessionActive: async () => true,
    } as never
  );
  const clients = Array.from({ length: 6 }, (_, index) => {
    const client = createClient();
    client.id = `socket-${index}`;
    Object.assign(client.data, {
      userId: "user-a",
      sessionId: "family-a",
    });
    return client;
  });

  for (const client of clients) {
    await gateway.handleConnection(client as never);
  }

  for (const client of clients.slice(0, 5)) {
    assert.equal(await client.data.ready, true);
    assert.equal(client.connected, true);
    await gateway.handleDisconnect(client as never);
  }
  assert.equal(await clients[5].data.ready, false);
  assert.equal(clients[5].connected, false);
  manager.onModuleDestroy();
});
