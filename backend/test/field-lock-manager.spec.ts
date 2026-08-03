import assert from "node:assert/strict";
import test from "node:test";
import {
  FieldLockLeaseError,
  FieldLockManager,
} from "../src/realtime/field-lock-manager";
import { RealtimeGateway } from "../src/realtime/realtime.gateway";

function acquireLock(manager: FieldLockManager, socketId = "socket-a") {
  return manager.acquire({
    key: "checklist-item:item-a",
    projectId: "project-a",
    userId: "user-a",
    username: "Ada",
    avatarUrl: null,
    socketId,
  });
}

test("keeps a lease bound to its acquiring socket", () => {
  const manager = new FieldLockManager();
  const first = acquireLock(manager);
  const second = acquireLock(manager, "socket-b");

  assert.equal(first.acquired, true);
  assert.equal(typeof first.token, "string");
  assert.equal(second.acquired, false);
  assert.equal(second.token, undefined);
  manager.onModuleDestroy();
});

test("fences a protected write with the current lease token", async () => {
  const manager = new FieldLockManager();
  const acquired = acquireLock(manager);
  assert.ok(acquired.token);

  let operationRan = false;
  await manager.withValidatedLease(
    "project-a",
    "checklist-item:item-a",
    "user-a",
    acquired.token,
    async () => undefined,
    async () => {
      operationRan = true;
    }
  );

  assert.equal(operationRan, true);
  await assert.rejects(
    manager.withValidatedLease(
      "project-a",
      "checklist-item:item-a",
      "user-a",
      "wrong-token",
      async () => undefined,
      async () => undefined
    ),
    FieldLockLeaseError
  );
  manager.onModuleDestroy();
});

test("rejects a lease presented under a different project scope", () => {
  const manager = new FieldLockManager();
  const acquired = acquireLock(manager);
  assert.ok(acquired.token);

  assert.throws(
    () =>
      manager.assertLeaseOwnerIfLocked(
        "project-b",
        "checklist-item:item-a",
        "user-a",
        acquired.token
      ),
    FieldLockLeaseError
  );
  manager.onModuleDestroy();
});

test("reclaims an expired lease before a different socket acquires it", () => {
  const manager = new FieldLockManager();
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;

  try {
    acquireLock(manager);
    now += 30_001;
    const replacement = acquireLock(manager, "socket-b");

    assert.equal(replacement.acquired, true);
    assert.equal(manager.get("checklist-item:item-a")?.socketId, "socket-b");
  } finally {
    Date.now = realNow;
    manager.onModuleDestroy();
  }
});

test("serializes a protected write before a competing release", async () => {
  const manager = new FieldLockManager();
  const acquired = acquireLock(manager);
  assert.ok(acquired.token);

  let allowWrite: () => void;
  const writeGate = new Promise<void>((resolve) => {
    allowWrite = resolve;
  });
  let completed = false;
  const write = manager.withValidatedLease(
    "project-a",
    "checklist-item:item-a",
    "user-a",
    acquired.token,
    async () => undefined,
    async () => {
      await writeGate;
      completed = true;
    }
  );
  const release = manager.releaseSocket("socket-a");

  await Promise.resolve();
  assert.equal(manager.get("checklist-item:item-a")?.socketId, "socket-a");
  allowWrite!();
  await write;
  await release;

  assert.equal(completed, true);
  assert.equal(manager.get("checklist-item:item-a"), undefined);
  manager.onModuleDestroy();
});

test("allows unrelated resources in the same project to proceed concurrently", async () => {
  const manager = new FieldLockManager();
  let releaseFirst: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let firstStarted: () => void;
  const firstReady = new Promise<void>((resolve) => {
    firstStarted = resolve;
  });

  const first = manager.withProjectResource(
    "project-a",
    "checklist-item:item-a",
    async () => {
      firstStarted!();
      await firstGate;
    }
  );
  await firstReady;

  let secondCompleted = false;
  await manager.withProjectResource(
    "project-a",
    "checklist-item:item-b",
    async () => {
      secondCompleted = true;
    }
  );

  assert.equal(secondCompleted, true);
  releaseFirst!();
  await first;
  manager.onModuleDestroy();
});

test("gives project-wide cleanup priority over later resource operations", async () => {
  const manager = new FieldLockManager();
  const order: string[] = [];
  let releaseFirst: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let firstStarted: () => void;
  const firstReady = new Promise<void>((resolve) => {
    firstStarted = resolve;
  });

  const first = manager.withProjectResource(
    "project-a",
    "checklist-item:item-a",
    async () => {
      order.push("first");
      firstStarted!();
      await firstGate;
    }
  );
  await firstReady;

  const cleanup = manager.withProject("project-a", async () => {
    order.push("cleanup");
  });
  const second = manager.withProjectResource(
    "project-a",
    "checklist-item:item-b",
    async () => {
      order.push("second");
    }
  );

  await Promise.resolve();
  assert.deepEqual(order, ["first"]);
  releaseFirst!();
  await Promise.all([first, cleanup, second]);

  assert.deepEqual(order, ["first", "cleanup", "second"]);
  manager.onModuleDestroy();
});

test("does not acquire a lease after the socket disconnects during validation", async () => {
  const manager = new FieldLockManager();
  let resolveMembership: (count: number) => void;
  const membership = new Promise<number>((resolve) => {
    resolveMembership = resolve;
  });
  let signalMembershipLookup: () => void;
  const membershipLookupStarted = new Promise<void>((resolve) => {
    signalMembershipLookup = resolve;
  });
  const gateway = new RealtimeGateway(
    {
      projectMember: {
        count: () => {
          signalMembershipLookup!();
          return membership;
        },
      },
    } as never,
    manager
  );
  gateway.registerKeyPrefixValidator("checklist-item", async () => "project-a");
  const client = {
    id: "socket-a",
    connected: true,
    rooms: new Set(["project:project-a"]),
    data: {
      ready: Promise.resolve(true),
      userId: "user-a",
      username: "Ada",
      avatarUrl: null,
    },
  };

  const response = gateway.handleFieldLock(client as never, {
    projectId: "project-a",
    key: "checklist-item:item-a",
  });
  await membershipLookupStarted;
  client.connected = false;
  resolveMembership!(1);

  assert.deepEqual(await response, {
    locked: false,
    lock: undefined,
    leaseToken: undefined,
  });
  assert.equal(manager.get("checklist-item:item-a"), undefined);
  manager.onModuleDestroy();
});
