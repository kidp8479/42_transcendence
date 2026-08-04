// Tests TaskAssigneeService.replaceAssignees's membership re-check, added to
// close the same TOCTOU family already fixed for rank in
// tasks.service.ts's moveTask() (Cricriiii #3 on PR#34's review): the
// caller-side assertAssigneesAreProjectMembers in TasksService runs BEFORE
// any transaction opens, so a membership change (removeMember) landing
// between that check and this call would go undetected without a fresh
// re-check at write time. No real database - same node:test + hand-rolled
// fake pattern as tasks-rank-invariants.spec.ts, minimal here since this
// only needs projectMember/taskAssignee, not the whole task store.
import assert from "node:assert/strict";
import test from "node:test";
import { TaskAssigneeService } from "../src/tasks/task-assignees.service";

interface FakeAssigneeStore {
  members: Set<string>; // userIds currently in the project
  assignees: Set<string>; // userIds currently assigned to the task
}

function createFakePrisma(store: FakeAssigneeStore) {
  const db = {
    projectMember: {
      count: async ({ where }: { where: { userId: { in: string[] } } }) =>
        where.userId.in.filter((userId) => store.members.has(userId)).length,
    },
    taskAssignee: {
      deleteMany: async () => {
        store.assignees.clear();
        return { count: 0 };
      },
      createMany: async ({
        data,
      }: {
        data: { userId: string; taskId: string }[];
      }) => {
        for (const row of data) {
          store.assignees.add(row.userId);
        }
        return { count: data.length };
      },
    },
  };
  return {
    ...db,
    transaction: async (operation: (database: typeof db) => Promise<unknown>) =>
      operation(db),
  };
}

test("replaceAssignees writes the new set when everyone is a current member", async () => {
  const store: FakeAssigneeStore = {
    members: new Set(["user-a", "user-b"]),
    assignees: new Set(),
  };
  const service = new TaskAssigneeService(createFakePrisma(store) as never);

  await service.replaceAssignees("task-1", "project-1", ["user-a", "user-b"]);

  assert.deepEqual([...store.assignees].sort(), ["user-a", "user-b"]);
});

test("replaceAssignees rejects a userId that isn't currently a project member", async () => {
  // Simulates the race: this id passed TasksService's own earlier check, but
  // by the time this call actually runs (write time, inside its own
  // transaction), the membership no longer holds - same as if removeMember
  // had landed in between.
  const store: FakeAssigneeStore = {
    members: new Set(["user-a"]),
    assignees: new Set(),
  };
  const service = new TaskAssigneeService(createFakePrisma(store) as never);

  await assert.rejects(
    () => service.replaceAssignees("task-1", "project-1", ["user-a", "user-b"]),
    /assigneeIds must all be members of this project/
  );
  // Rejected before either write ran - the old assignee set survives
  // untouched, not silently wiped.
  assert.deepEqual([...store.assignees], []);
});

test("replaceAssignees with an empty list clears assignees without a membership check", async () => {
  const store: FakeAssigneeStore = {
    members: new Set(),
    assignees: new Set(["user-a"]),
  };
  const service = new TaskAssigneeService(createFakePrisma(store) as never);

  await service.replaceAssignees("task-1", "project-1", []);

  assert.deepEqual([...store.assignees], []);
});
