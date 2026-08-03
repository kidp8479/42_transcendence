// Integration-style tests for TasksService's rank-maintenance invariant:
// every status column stays a dense 0..n-1 sequence, no matter what sequence
// of create/move/delete operations hits it. Requested by Andrei on PR#34
// (review finding, 2026-08-02): "la logique de maintien des rangs est
// centrale et complexe... tests d'intégration ciblant la création, les
// déplacements intra/inter-colonnes, la suppression et les conflits de
// sérialisation."
//
// No real database: this project's test runner is plain node:test (see
// field-lock-manager.spec.ts/websocket-admission.spec.ts for the same
// pattern), not Jest with a Nest TestModule. FakeTaskStore below is a
// minimal in-memory stand-in for the one slice of Prisma.task the service
// actually calls - count/updateMany/create/findUniqueOrThrow/update/delete/
// findFirst, with just the where-clause shapes tasks.service.ts uses
// (projectId/status/rank comparisons, id: { not }). It intentionally does
// NOT model real transactional isolation: tests run single-threaded and
// sequential, which is enough to verify the invariant these operations
// maintain, not the concurrency behaviour Postgres's Serializable isolation
// itself provides (that needs a real database, out of scope for a unit test).
import assert from "node:assert/strict";
import test from "node:test";
import { TaskStatus } from "@prisma/client";
import { TasksService } from "../src/tasks/tasks.service";

interface FakeTaskRow {
  id: string;
  projectId: string;
  status: TaskStatus;
  rank: number;
  title: string;
  categoryId: string | null;
  priority: string;
  startAt: string | null;
  endAt: string | null;
  description: string | null;
  notes: string | null;
  onCalendar: boolean;
}

type Where = Record<string, unknown>;

function matches(row: FakeTaskRow, where: Where): boolean {
  if (where.projectId !== undefined && row.projectId !== where.projectId) {
    return false;
  }
  if (where.status !== undefined && row.status !== where.status) {
    return false;
  }
  if (where.id !== undefined) {
    const idFilter = where.id;
    if (typeof idFilter === "string") {
      if (row.id !== idFilter) {
        return false;
      }
    } else {
      const not = (idFilter as { not?: string }).not;
      if (not !== undefined && row.id === not) {
        return false;
      }
    }
  }
  if (where.rank !== undefined) {
    const rankFilter = where.rank as { gte?: number; gt?: number };
    if (rankFilter.gte !== undefined && !(row.rank >= rankFilter.gte)) {
      return false;
    }
    if (rankFilter.gt !== undefined && !(row.rank > rankFilter.gt)) {
      return false;
    }
  }
  return true;
}

class FakeTaskStore {
  rows: FakeTaskRow[] = [];
  private nextId = 0;

  async count({ where }: { where: Where }): Promise<number> {
    return this.rows.filter((row) => matches(row, where)).length;
  }

  async updateMany({
    where,
    data,
  }: {
    where: Where;
    data: { rank?: { increment?: number; decrement?: number } };
  }): Promise<{ count: number }> {
    const matched = this.rows.filter((row) => matches(row, where));
    for (const row of matched) {
      if (data.rank?.increment !== undefined) {
        row.rank += data.rank.increment;
      }
      if (data.rank?.decrement !== undefined) {
        row.rank -= data.rank.decrement;
      }
    }
    return { count: matched.length };
  }

  async create({ data }: { data: Omit<FakeTaskRow, "id"> }) {
    const row: FakeTaskRow = { id: `task-${this.nextId++}`, ...data };
    this.rows.push(row);
    return row;
  }

  async findUniqueOrThrow({
    where,
    select,
  }: {
    where: { id: string };
    select?: Partial<Record<keyof FakeTaskRow, boolean>>;
  }) {
    const row = this.rows.find((candidate) => candidate.id === where.id);
    if (!row) {
      throw new Error(`FakeTaskStore: task ${where.id} not found`);
    }
    if (!select) {
      return row;
    }
    const picked: Partial<FakeTaskRow> = {};
    for (const key of Object.keys(select) as (keyof FakeTaskRow)[]) {
      picked[key] = row[key] as never;
    }
    return picked;
  }

  async update({
    where,
    data,
  }: {
    where: { id: string };
    data: Partial<FakeTaskRow>;
  }) {
    const row = this.rows.find((candidate) => candidate.id === where.id);
    if (!row) {
      throw new Error(`FakeTaskStore: task ${where.id} not found`);
    }
    // Real Prisma treats an undefined-valued field as "not provided" and
    // omits it from the SQL UPDATE - only an explicit null clears a nullable
    // column. TasksService's taskFields object always carries every key
    // (title, categoryId, ...), undefined ones included, for fields the
    // caller's DTO didn't send. A plain Object.assign would blindly
    // overwrite those with undefined instead of leaving them alone.
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (row as unknown as Record<string, unknown>)[key] = value;
      }
    }
    return row;
  }

  async delete({ where }: { where: { id: string } }) {
    const index = this.rows.findIndex((candidate) => candidate.id === where.id);
    if (index === -1) {
      throw new Error(`FakeTaskStore: task ${where.id} not found`);
    }
    const [row] = this.rows.splice(index, 1);
    return { ...row, category: null, assignees: [] };
  }

  async findFirst({ where }: { where: Where }) {
    const row = this.rows.find((candidate) => matches(candidate, where));
    if (!row) {
      return null;
    }
    return { ...row, category: null, assignees: [] };
  }

  // Test helper, not a Prisma method: ranks of every task in a column, in
  // rank order - what every assertion below actually checks.
  ranksIn(projectId: string, status: TaskStatus): number[] {
    return this.rows
      .filter((row) => row.projectId === projectId && row.status === status)
      .sort((a, b) => a.rank - b.rank)
      .map((row) => row.rank);
  }

  idsInRankOrder(projectId: string, status: TaskStatus): string[] {
    return this.rows
      .filter((row) => row.projectId === projectId && row.status === status)
      .sort((a, b) => a.rank - b.rank)
      .map((row) => row.id);
  }
}

// A db-shaped wrapper so `this.prisma.task.count(...)` and the transaction
// callback's `database.task.count(...)` both resolve against the exact same
// FakeTaskStore instance - single source of truth, matching how a real
// Prisma transaction still shares the row data with the outer client
// (SERIALIZABLE, not a separate in-memory copy).
function createFakePrisma(store: FakeTaskStore) {
  const db = {
    task: store,
    taskCategory: { findFirst: async () => ({ id: "cat-a" }) },
  };
  return {
    ...db,
    transaction: async (operation: (database: typeof db) => Promise<unknown>) =>
      operation(db),
  };
}

const projectAssignedStub = { assertMembership: async () => undefined };
const noopTaskAssignees = { replaceAssignees: async () => undefined };

function createService(store: FakeTaskStore) {
  return new TasksService(
    createFakePrisma(store) as never,
    noopTaskAssignees as never,
    projectAssignedStub as never
  );
}

const projectId = "project-a";
const userId = "user-a";

function baseCreateDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: "Task",
    categoryId: "cat-a",
    status: TaskStatus.TODO,
    priority: "MEDIUM",
    rank: 0,
    onCalendar: false,
    ...overrides,
  } as never;
}

// -- Creation ---------------------------------------------------------------

test("create() appends to an empty column at rank 0", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  await service.create(projectId, baseCreateDto({ rank: 0 }), userId);

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), [0]);
});

test("create() at a middle rank shifts everything after it, keeping the column dense", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  // Seed A, B, C at ranks 0, 1, 2.
  for (const title of ["A", "B", "C"]) {
    await service.create(
      projectId,
      baseCreateDto({
        title,
        rank: store.ranksIn(projectId, TaskStatus.TODO).length,
      }),
      userId
    );
  }
  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), [0, 1, 2]);

  // Insert D at rank 1 - should land between A and B, pushing B and C down one.
  await service.create(
    projectId,
    baseCreateDto({ title: "D", rank: 1 }),
    userId
  );

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), [0, 1, 2, 3]);
  const titlesInOrder = store.rows
    .filter((row) => row.status === TaskStatus.TODO)
    .sort((a, b) => a.rank - b.rank)
    .map((row) => row.title);
  assert.deepEqual(titlesInOrder, ["A", "D", "B", "C"]);
});

test("create() clamps an out-of-range rank instead of leaving a hole", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  // Empty column, but the client asks for rank 99 - clamp to 0, not a hole
  // at ranks 1..98.
  await service.create(projectId, baseCreateDto({ rank: 99 }), userId);

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), [0]);
});

// -- Intra-column moves -------------------------------------------------------

test("update() moving a task later in the same column keeps the column dense", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  for (const title of ["A", "B", "C", "D"]) {
    await service.create(
      projectId,
      baseCreateDto({
        title,
        rank: store.ranksIn(projectId, TaskStatus.TODO).length,
      }),
      userId
    );
  }
  const taskA = store.rows.find((row) => row.title === "A")!;

  // A (rank 0) dropped just before C (originally rank 2, without A that's
  // rank 1) - the exact same-column drag scenario from review finding #1.
  await service.update(taskA.id, { rank: 1 } as never, projectId, userId);

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), [0, 1, 2, 3]);
  assert.deepEqual(
    store
      .idsInRankOrder(projectId, TaskStatus.TODO)
      .map((id) => store.rows.find((row) => row.id === id)!.title),
    ["B", "A", "C", "D"]
  );
});

test("update() moving a task earlier in the same column keeps the column dense", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  for (const title of ["A", "B", "C", "D"]) {
    await service.create(
      projectId,
      baseCreateDto({
        title,
        rank: store.ranksIn(projectId, TaskStatus.TODO).length,
      }),
      userId
    );
  }
  const taskD = store.rows.find((row) => row.title === "D")!;

  await service.update(taskD.id, { rank: 0 } as never, projectId, userId);

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), [0, 1, 2, 3]);
  const titlesInOrder = store
    .idsInRankOrder(projectId, TaskStatus.TODO)
    .map((id) => store.rows.find((row) => row.id === id)!.title);
  assert.deepEqual(titlesInOrder, ["D", "A", "B", "C"]);
});

// -- Inter-column moves -------------------------------------------------------

test("update() moving a task to another column closes the old column's gap and opens a slot in the new one", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  for (const title of ["A", "B", "C"]) {
    await service.create(
      projectId,
      baseCreateDto({
        title,
        rank: store.ranksIn(projectId, TaskStatus.TODO).length,
      }),
      userId
    );
  }
  await service.create(
    projectId,
    baseCreateDto({ title: "X", status: TaskStatus.IN_PROGRESS, rank: 0 }),
    userId
  );
  const taskB = store.rows.find((row) => row.title === "B")!;

  // B moves TODO -> IN_PROGRESS, landing before X.
  await service.update(
    taskB.id,
    { status: TaskStatus.IN_PROGRESS, rank: 0 } as never,
    projectId,
    userId
  );

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), [0, 1]);
  assert.deepEqual(
    store
      .idsInRankOrder(projectId, TaskStatus.TODO)
      .map((id) => store.rows.find((row) => row.id === id)!.title),
    ["A", "C"]
  );
  assert.deepEqual(store.ranksIn(projectId, TaskStatus.IN_PROGRESS), [0, 1]);
  assert.deepEqual(
    store
      .idsInRankOrder(projectId, TaskStatus.IN_PROGRESS)
      .map((id) => store.rows.find((row) => row.id === id)!.title),
    ["B", "X"]
  );
});

test("update() with a status change but no rank appends to the end of the new column", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  await service.create(
    projectId,
    baseCreateDto({ title: "A", rank: 0 }),
    userId
  );
  for (const title of ["X", "Y"]) {
    await service.create(
      projectId,
      baseCreateDto({
        title,
        status: TaskStatus.IN_PROGRESS,
        rank: store.ranksIn(projectId, TaskStatus.IN_PROGRESS).length,
      }),
      userId
    );
  }
  const taskA = store.rows.find((row) => row.title === "A")!;

  // Status-only change (e.g. from the drawer, not a drag) - no rank in the
  // DTO at all, must NOT reuse A's old rank (0) inside the new column.
  await service.update(
    taskA.id,
    { status: TaskStatus.IN_PROGRESS } as never,
    projectId,
    userId
  );

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.IN_PROGRESS), [0, 1, 2]);
  assert.deepEqual(
    store
      .idsInRankOrder(projectId, TaskStatus.IN_PROGRESS)
      .map((id) => store.rows.find((row) => row.id === id)!.title),
    ["X", "Y", "A"]
  );
});

// -- Deletion -----------------------------------------------------------------

test("remove() closes the gap left in the middle of a column", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  for (const title of ["A", "B", "C", "D"]) {
    await service.create(
      projectId,
      baseCreateDto({
        title,
        rank: store.ranksIn(projectId, TaskStatus.TODO).length,
      }),
      userId
    );
  }
  const taskB = store.rows.find((row) => row.title === "B")!;

  await service.remove(taskB.id, projectId, userId);

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), [0, 1, 2]);
  const titlesInOrder = store
    .idsInRankOrder(projectId, TaskStatus.TODO)
    .map((id) => store.rows.find((row) => row.id === id)!.title);
  assert.deepEqual(titlesInOrder, ["A", "C", "D"]);
});

test("remove() of the last task in a column leaves it empty, not negative-ranked", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);

  await service.create(projectId, baseCreateDto({ rank: 0 }), userId);
  const [only] = store.rows;

  await service.remove(only.id, projectId, userId);

  assert.deepEqual(store.ranksIn(projectId, TaskStatus.TODO), []);
});

// -- Serialization conflicts --------------------------------------------------

// A real Postgres serialization failure (Prisma error code P2034) can only
// happen with actual concurrent transactions - out of reach for this
// single-threaded, no-database test. What IS unit-testable, and is the
// actual invariant that matters here: none of moveTask()/create()/remove()
// catch and swallow a transaction failure. If they did, the client would see
// a silently-successful request instead of the 409 the global Prisma filter
// is supposed to turn a P2034 into, and would trust a UI state that no
// longer matches the database.
function serializationConflictError() {
  const error = new Error(
    "could not serialize access due to concurrent update"
  );
  (error as { code?: string }).code = "P2034";
  return error;
}

test("create() propagates a transaction failure instead of swallowing it", async () => {
  const store = new FakeTaskStore();
  const fakePrisma = createFakePrisma(store);
  fakePrisma.transaction = async () => {
    throw serializationConflictError();
  };
  const service = new TasksService(
    fakePrisma as never,
    noopTaskAssignees as never,
    projectAssignedStub as never
  );

  await assert.rejects(
    () => service.create(projectId, baseCreateDto(), userId),
    (error: { code?: string }) => error.code === "P2034"
  );
});

test("update() moving a task propagates a transaction failure instead of swallowing it", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);
  await service.create(projectId, baseCreateDto({ rank: 0 }), userId);
  const [task] = store.rows;

  const fakePrisma = createFakePrisma(store);
  fakePrisma.transaction = async () => {
    throw serializationConflictError();
  };
  const brokenService = new TasksService(
    fakePrisma as never,
    noopTaskAssignees as never,
    projectAssignedStub as never
  );

  // rank must actually differ from the task's current rank (0, from the
  // create() above) - otherwise isMoving is false and update() takes the
  // plain non-transactional path entirely, never touching the broken
  // transaction this test means to exercise.
  await assert.rejects(
    () =>
      brokenService.update(task.id, { rank: 1 } as never, projectId, userId),
    (error: { code?: string }) => error.code === "P2034"
  );
});

test("remove() propagates a transaction failure instead of swallowing it", async () => {
  const store = new FakeTaskStore();
  const service = createService(store);
  await service.create(projectId, baseCreateDto({ rank: 0 }), userId);
  const [task] = store.rows;

  const fakePrisma = createFakePrisma(store);
  fakePrisma.transaction = async () => {
    throw serializationConflictError();
  };
  const brokenService = new TasksService(
    fakePrisma as never,
    noopTaskAssignees as never,
    projectAssignedStub as never
  );

  await assert.rejects(
    () => brokenService.remove(task.id, projectId, userId),
    (error: { code?: string }) => error.code === "P2034"
  );
});
