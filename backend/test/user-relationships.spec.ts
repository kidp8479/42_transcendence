// Tests UserRelationshipsService's directional-row state machine - the part
// three separate review findings slipped through (BLOCKED leaking through
// findAll/findById, the blocker still getting notified on create(), a block
// still being bypassable from the requester's side). A transition table
// catches all three at once instead of one bug at a time. No real database -
// same node:test + hand-rolled fake pattern as task-assignees.spec.ts: an
// in-memory Map keyed by the same requesterId_addresseeId compound unique
// index Prisma uses, with a transaction() that just runs the callback
// against it (no real Serializable isolation - out of scope here, see
// tasks-rank-invariants.spec.ts's own note on the same tradeoff).
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RelationshipStatus } from "@prisma/client";
import { UserRelationshipsService } from "../src/user-relationships/user-relationships.service";
import { UsersService } from "../src/users/users.service";

interface FakeRow {
  requesterId: string;
  addresseeId: string;
  status: RelationshipStatus;
}

type Where = Record<string, unknown>;

function keyOf(requesterId: string, addresseeId: string) {
  return `${requesterId}:${addresseeId}`;
}

// Only the flat fields this service ever filters on (requesterId /
// addresseeId, each either a literal, a `{ not }`, or a `{ in }` - the last
// one for getPresence's batch lookup); OR is handled separately below since
// findAll/findById/getPresence are the only callers that use it.
function matchesFlat(row: FakeRow, where: Where): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (key === "OR") continue;
    const actual = (row as Record<string, unknown>)[key];
    if (value !== null && typeof value === "object" && "not" in value) {
      if (actual === (value as { not: unknown }).not) return false;
    } else if (value !== null && typeof value === "object" && "in" in value) {
      if (!(value as { in: unknown[] }).in.includes(actual)) return false;
    } else if (actual !== value) {
      return false;
    }
  }
  return true;
}

function createFakeRelationshipStore(seed: FakeRow[] = []) {
  const rows = new Map<string, FakeRow>();
  for (const row of seed) {
    rows.set(keyOf(row.requesterId, row.addresseeId), { ...row });
  }

  const userRelationship = {
    findFirst: async ({ where }: { where: Where }) => {
      for (const row of rows.values()) {
        if (matchesFlat(row, where)) return { ...row };
      }
      return null;
    },
    findMany: async ({ where }: { where: Where }) => {
      const clauses = (where.OR as Where[] | undefined) ?? [where];
      return [...rows.values()]
        .filter((row) => clauses.some((clause) => matchesFlat(row, clause)))
        .map((row) => ({ ...row }));
    },
    findUnique: async ({
      where,
    }: {
      where: {
        requesterId_addresseeId: { requesterId: string; addresseeId: string };
      };
    }) => {
      const { requesterId, addresseeId } = where.requesterId_addresseeId;
      const row = rows.get(keyOf(requesterId, addresseeId));
      return row ? { ...row } : null;
    },
    create: async ({ data }: { data: FakeRow }) => {
      const row = { ...data };
      rows.set(keyOf(row.requesterId, row.addresseeId), row);
      return { ...row };
    },
    update: async ({
      where,
      data,
    }: {
      where: {
        requesterId_addresseeId: { requesterId: string; addresseeId: string };
      };
      data: { status: RelationshipStatus };
    }) => {
      const { requesterId, addresseeId } = where.requesterId_addresseeId;
      const row = rows.get(keyOf(requesterId, addresseeId));
      if (!row) throw new Error("no row to update");
      row.status = data.status;
      return { ...row };
    },
    delete: async ({
      where,
    }: {
      where: {
        requesterId_addresseeId: { requesterId: string; addresseeId: string };
      };
    }) => {
      const { requesterId, addresseeId } = where.requesterId_addresseeId;
      const key = keyOf(requesterId, addresseeId);
      const row = rows.get(key);
      if (!row) throw new Error("no row to delete");
      rows.delete(key);
      return { ...row };
    },
    deleteMany: async ({ where }: { where: Where }) => {
      let count = 0;
      for (const [key, row] of rows.entries()) {
        if (matchesFlat(row, where)) {
          rows.delete(key);
          count++;
        }
      }
      return { count };
    },
  };

  return {
    rows,
    prisma: {
      userRelationship,
      transaction: async (
        operation: (database: {
          userRelationship: typeof userRelationship;
        }) => Promise<unknown>
      ) => operation({ userRelationship }),
    },
  };
}

function statusOf(
  rows: Map<string, FakeRow>,
  requesterId: string,
  addresseeId: string
) {
  return rows.get(keyOf(requesterId, addresseeId))?.status;
}

// create()/update() both look up the requester's username for a notification
// after their own transaction commits - stubbed to a fixed user, no test
// here asserts on notification content.
function createFakeUserService() {
  return {
    findById: async (id: string) => ({ id, username: "someone" }),
  };
}

function createFakeSideEffects() {
  const notifications: unknown[] = [];
  const events: { userId: string; event: string }[] = [];
  return {
    notificationService: {
      create: async (userId: string, ...rest: unknown[]) => {
        notifications.push({ userId, rest });
      },
    },
    realtimeService: {
      emitToUser: (userId: string, event: string) => {
        events.push({ userId, event });
      },
    },
    notifications,
    events,
  };
}

function buildService(seed: FakeRow[] = []) {
  const store = createFakeRelationshipStore(seed);
  const sideEffects = createFakeSideEffects();
  const service = new UserRelationshipsService(
    store.prisma as never,
    sideEffects.realtimeService as never,
    sideEffects.notificationService as never,
    createFakeUserService() as never
  );
  return { service, ...store, ...sideEffects };
}

const alice = "11111111-1111-1111-1111-111111111111";
const bob = "22222222-2222-2222-2222-222222222222";

// --- create -> accept -> remove --------------------------------------------

test("create -> accept -> remove: full happy-path transition table", async () => {
  const { service, rows } = buildService();

  await service.create(bob, alice);
  assert.equal(statusOf(rows, alice, bob), RelationshipStatus.ACCEPTED);
  assert.equal(statusOf(rows, bob, alice), RelationshipStatus.PENDING_APPROVAL);

  await service.update(alice, { status: RelationshipStatus.ACCEPTED }, bob);
  assert.equal(statusOf(rows, alice, bob), RelationshipStatus.ACCEPTED);
  assert.equal(statusOf(rows, bob, alice), RelationshipStatus.ACCEPTED);

  await service.remove(bob, alice);
  assert.equal(rows.size, 0);
});

// --- block / unblock from each starting state -------------------------------

test("block then unblock from no prior relationship deletes the row (no counterpart)", async () => {
  const { service, rows } = buildService();

  await service.update(bob, { status: RelationshipStatus.BLOCKED }, alice);
  assert.equal(statusOf(rows, alice, bob), RelationshipStatus.BLOCKED);

  await service.update(bob, { status: RelationshipStatus.ACCEPTED }, alice);
  assert.equal(rows.has(keyOf(alice, bob)), false);
});

test("block then unblock from PENDING_APPROVAL, counterpart still present, resurrects as ACCEPTED", async () => {
  // alice requested bob: alice's row ACCEPTED, bob's row PENDING_APPROVAL.
  const { service, rows } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.ACCEPTED,
    },
    {
      requesterId: bob,
      addresseeId: alice,
      status: RelationshipStatus.PENDING_APPROVAL,
    },
  ]);

  // bob blocks alice instead of answering, then changes their mind.
  await service.update(alice, { status: RelationshipStatus.BLOCKED }, bob);
  assert.equal(statusOf(rows, bob, alice), RelationshipStatus.BLOCKED);

  await service.update(alice, { status: RelationshipStatus.ACCEPTED }, bob);
  assert.equal(statusOf(rows, bob, alice), RelationshipStatus.ACCEPTED);
  // alice's own row is untouched by bob's update - still what it was.
  assert.equal(statusOf(rows, alice, bob), RelationshipStatus.ACCEPTED);
});

test("block then unblock from ACCEPTED, counterpart still present, resurrects as ACCEPTED", async () => {
  const { service, rows } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.ACCEPTED,
    },
    {
      requesterId: bob,
      addresseeId: alice,
      status: RelationshipStatus.ACCEPTED,
    },
  ]);

  await service.update(bob, { status: RelationshipStatus.BLOCKED }, alice);
  assert.equal(statusOf(rows, alice, bob), RelationshipStatus.BLOCKED);

  await service.update(bob, { status: RelationshipStatus.ACCEPTED }, alice);
  assert.equal(statusOf(rows, alice, bob), RelationshipStatus.ACCEPTED);
});

test("update() deletes rather than resurrects an unblock with no counterpart row", async () => {
  const { service, rows } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.BLOCKED,
    },
  ]);

  await service.update(bob, { status: RelationshipStatus.ACCEPTED }, alice);

  assert.equal(rows.has(keyOf(alice, bob)), false);
});

test("update() deletes rather than resurrects an unblock when the counterpart has independently blocked back", async () => {
  const { service, rows } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.BLOCKED,
    },
    {
      requesterId: bob,
      addresseeId: alice,
      status: RelationshipStatus.BLOCKED,
    },
  ]);

  // alice lifts her own block on bob, but bob still has alice blocked.
  await service.update(bob, { status: RelationshipStatus.ACCEPTED }, alice);

  assert.equal(rows.has(keyOf(alice, bob)), false);
  // bob's own block on alice is untouched - only alice's row was ever
  // reachable through this call.
  assert.equal(statusOf(rows, bob, alice), RelationshipStatus.BLOCKED);
});

// --- remove() and BLOCKED rows ----------------------------------------------

test("remove() leaves a BLOCKED row untouched but deletes the other side's", async () => {
  const { service, rows } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.BLOCKED,
    },
    {
      requesterId: bob,
      addresseeId: alice,
      status: RelationshipStatus.ACCEPTED,
    },
  ]);

  // bob (the blocked side) tries to remove the relationship.
  await service.remove(alice, bob);

  assert.equal(statusOf(rows, alice, bob), RelationshipStatus.BLOCKED);
  assert.equal(rows.has(keyOf(bob, alice)), false);
});

test("remove() no-ops entirely when both directions are BLOCKED", async () => {
  const { service, rows } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.BLOCKED,
    },
    {
      requesterId: bob,
      addresseeId: alice,
      status: RelationshipStatus.BLOCKED,
    },
  ]);

  await service.remove(bob, alice);

  assert.equal(rows.size, 2);
});

// --- BLOCKED must never leak through findAll/findById -----------------------

test("findAll masks a BLOCKED counterpart row as ACCEPTED", async () => {
  const { service } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.ACCEPTED,
    },
    {
      requesterId: bob,
      addresseeId: alice,
      status: RelationshipStatus.BLOCKED,
    },
  ]);

  const result = await service.findAll(alice);

  const theirs = result.find((row) => row.requesterId === bob);
  assert.equal(theirs?.status, RelationshipStatus.ACCEPTED);
});

test("findAll never masks the caller's own BLOCKED row", async () => {
  const { service } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.BLOCKED,
    },
  ]);

  const result = await service.findAll(alice);

  const mine = result.find((row) => row.requesterId === alice);
  assert.equal(mine?.status, RelationshipStatus.BLOCKED);
});

test("findById masks a BLOCKED counterpart row as ACCEPTED", async () => {
  const { service } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.ACCEPTED,
    },
    {
      requesterId: bob,
      addresseeId: alice,
      status: RelationshipStatus.BLOCKED,
    },
  ]);

  const result = await service.findById(bob, alice);

  const theirs = result.find((row) => row.requesterId === bob);
  assert.equal(theirs?.status, RelationshipStatus.ACCEPTED);
});

// --- create() and an existing block ------------------------------------------

test("create() rejects a request toward someone the caller has already blocked", async () => {
  const { service } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.BLOCKED,
    },
  ]);

  await assert.rejects(service.create(bob, alice), ForbiddenException);
});

test("create() succeeds outwardly but writes nothing and notifies no one when the addressee has blocked the requester", async () => {
  const { service, rows, notifications, events } = buildService([
    {
      requesterId: bob,
      addresseeId: alice,
      status: RelationshipStatus.BLOCKED,
    },
  ]);

  const result = await service.create(bob, alice);

  assert.deepEqual(result, [alice, bob]);
  assert.equal(rows.has(keyOf(alice, bob)), false);
  assert.equal(notifications.length, 0);
  assert.equal(events.length, 0);
});

test("update() rejects PENDING_APPROVAL as a PATCH target", async () => {
  const { service } = buildService([
    {
      requesterId: alice,
      addresseeId: bob,
      status: RelationshipStatus.ACCEPTED,
    },
  ]);

  await assert.rejects(
    service.update(bob, { status: RelationshipStatus.PENDING_APPROVAL }, alice),
    ForbiddenException
  );
});

test("update() 404s when there is no existing relationship and the target status isn't BLOCKED", async () => {
  const { service } = buildService();

  await assert.rejects(
    service.update(bob, { status: RelationshipStatus.ACCEPTED }, alice),
    NotFoundException
  );
});

// --- getPresence -------------------------------------------------------------

function buildUsersServiceForPresence(seed: FakeRow[], online: Set<string>) {
  const store = createFakeRelationshipStore(seed);
  const realtimeService = { isUserOnline: (id: string) => online.has(id) };
  const service = new UsersService(
    store.prisma as never,
    {} as never,
    {} as never,
    realtimeService as never
  );
  return service;
}

test("getPresence returns false for a non-friend id even if they are actually online", async () => {
  const service = buildUsersServiceForPresence([], new Set([bob]));

  const presence = await service.getPresence([bob], alice);

  assert.equal(presence[bob], false);
});

test("getPresence returns the real status for a mutual, ACCEPTED friend", async () => {
  const service = buildUsersServiceForPresence(
    [
      {
        requesterId: alice,
        addresseeId: bob,
        status: RelationshipStatus.ACCEPTED,
      },
      {
        requesterId: bob,
        addresseeId: alice,
        status: RelationshipStatus.ACCEPTED,
      },
    ],
    new Set([bob])
  );

  const presence = await service.getPresence([bob], alice);

  assert.equal(presence[bob], true);
});

test("getPresence returns false for a friend who has blocked the caller", async () => {
  const service = buildUsersServiceForPresence(
    [
      {
        requesterId: alice,
        addresseeId: bob,
        status: RelationshipStatus.ACCEPTED,
      },
      {
        requesterId: bob,
        addresseeId: alice,
        status: RelationshipStatus.BLOCKED,
      },
    ],
    new Set([bob])
  );

  const presence = await service.getPresence([bob], alice);

  assert.equal(presence[bob], false);
});
