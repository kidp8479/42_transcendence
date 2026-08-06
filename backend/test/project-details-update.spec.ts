// Tests ProjectsService.updateDetails()'s two subtle behaviors that a
// browser pass alone missed, both found via manual/PR review: the
// optimistic-concurrency 409 (Prisma's compound where clause matching zero
// rows once someone else's edit landed), and null vs. undefined for
// clearing a nullable column. Also guards the no-op-save notification fix
// (skip the notification when nothing actually changed). No real database -
// same node:test + hand-rolled fake pattern as task-assignees.spec.ts.
import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ProjectsService } from "../src/projects/projects.service";

interface FakeProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isArchived: boolean;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FakeStore {
  project: FakeProjectRow;
  members: { userId: string; role: string }[];
  usernames: Record<string, string>;
  notifications: { userId: string; message: string; link?: string }[];
  updatedAtCounter: number;
}

function createFakePrisma(store: FakeStore) {
  return {
    projectMember: {
      findFirst: async ({
        where,
      }: {
        where: { projectId: string; userId: string };
      }) =>
        where.projectId === store.project.id
          ? (store.members.find((m) => m.userId === where.userId) ?? null)
          : null,
      findMany: async ({
        where,
      }: {
        where: { projectId: string; userId: { not: string } };
      }) =>
        store.members
          .filter((m) => m.userId !== where.userId.not)
          .map((m) => ({ userId: m.userId })),
    },
    project: {
      // Ignores where/select - there's only ever one project in this store,
      // and the service only ever reads name/description off the result.
      findUniqueOrThrow: async () => ({ ...store.project }),
      update: async ({
        where,
        data,
      }: {
        where: { id: string; updatedAt: Date };
        data: { name: string; description?: string | null };
      }) => {
        // Mirrors Prisma's real behavior for this compound where clause:
        // zero rows match once updatedAt has moved on, which Prisma
        // surfaces as P2025, not a normal "not found" return value.
        if (
          where.id !== store.project.id ||
          where.updatedAt.toISOString() !== store.project.updatedAt
        ) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Record to update not found",
            { code: "P2025", clientVersion: "test" }
          );
        }
        store.project.name = data.name;
        // undefined = not included in this request = leave untouched;
        // null = explicitly clear it. Same distinction the real DTO/Prisma
        // combination relies on.
        if (data.description !== undefined) {
          store.project.description = data.description;
        }
        store.project.updatedAt = `2026-01-01T00:00:00.${String(
          store.updatedAtCounter++
        ).padStart(3, "0")}Z`;
        return {
          ...store.project,
          evaluationChecklistItems: [],
          _count: { members: store.members.length },
        };
      },
    },
    user: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        username: store.usernames[where.id],
      }),
    },
  };
}

function createService(store: FakeStore) {
  return new ProjectsService(
    createFakePrisma(store) as never,
    { emitToProject: () => {} } as never,
    {
      create: async (userId: string, message: string, link?: string) => {
        store.notifications.push({ userId, message, link });
      },
    } as never
  );
}

function baseStore(): FakeStore {
  return {
    project: {
      id: "project-1",
      name: "spongebob",
      description: "abc",
      status: "IN_PROGRESS",
      isArchived: false,
      deadline: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    members: [
      { userId: "owner-1", role: "OWNER" },
      { userId: "member-1", role: "MEMBER" },
    ],
    usernames: { "owner-1": "carlos" },
    notifications: [],
    updatedAtCounter: 1,
  };
}

test("updateDetails rejects a save based on a stale updatedAt with 409", async () => {
  const store = baseStore();
  const service = createService(store);

  await service.updateDetails(
    "project-1",
    { name: "renamed once", updatedAt: store.project.updatedAt } as never,
    "owner-1"
  );

  // Simulates a second editor whose form was seeded before the first save
  // landed: still using the ORIGINAL (now stale) updatedAt.
  await assert.rejects(
    () =>
      service.updateDetails(
        "project-1",
        {
          name: "renamed twice",
          updatedAt: "2026-01-01T00:00:00.000Z",
        } as never,
        "owner-1"
      ),
    ConflictException
  );
  // The first save's write survives, not overwritten by the rejected second one.
  assert.equal(store.project.name, "renamed once");
});

test("updateDetails clears description with an explicit null, not left unchanged", async () => {
  const store = baseStore();
  const service = createService(store);
  assert.equal(store.project.description, "abc");

  const result = await service.updateDetails(
    "project-1",
    {
      name: "spongebob",
      description: null,
      updatedAt: store.project.updatedAt,
    } as never,
    "owner-1"
  );

  assert.equal(store.project.description, null);
  assert.equal(result.description, null);
});

test("updateDetails skips the notification on a no-op save but sends one on a real change", async () => {
  const store = baseStore();
  const service = createService(store);

  await service.updateDetails(
    "project-1",
    {
      name: "spongebob",
      description: "abc",
      updatedAt: store.project.updatedAt,
    } as never,
    "owner-1"
  );
  assert.equal(store.notifications.length, 0);

  await service.updateDetails(
    "project-1",
    {
      name: "spongebob renamed",
      description: "abc",
      updatedAt: store.project.updatedAt,
    } as never,
    "owner-1"
  );
  assert.equal(store.notifications.length, 1);
  assert.equal(store.notifications[0]?.userId, "member-1");
});
