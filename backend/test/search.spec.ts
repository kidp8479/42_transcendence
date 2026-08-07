// Tests SearchService's query construction - the access-scoping predicates
// above all, since they are the whole security boundary of /api/search and a
// refactor could drop one without any visible symptom: search would just start
// returning other people's projects, and a single-account manual test would
// never notice. Same node:test + hand-rolled fake pattern as
// task-assignees.spec.ts: no real database, we assert on the arguments the fake
// Prisma received rather than on rows it returned.
import assert from "node:assert/strict";
import test from "node:test";
import { SearchService } from "../src/search/search.service";
import type { SearchQueryDto } from "../src/search/dto/search-query.dto";

interface FindManyArgs {
  where?: Record<string, unknown>;
  // Captured because `select` is what actually keeps User.email inside the
  // backend - asserting only on `where` would let a switch to `include`, or a
  // stray `email: true`, pass every test in this file.
  select?: Record<string, unknown>;
  orderBy?: Record<string, string>[];
  skip?: number;
  take?: number;
}

type ModelName = "project" | "task" | "user";

// Records every findMany call so a test can inspect the query that was built.
// count() is what feeds the `total` fields; it returns a fixed number since no
// test here asserts on totals.
function createFakePrisma(rows: Partial<Record<ModelName, unknown[]>> = {}) {
  const calls: Record<ModelName, FindManyArgs[]> = {
    project: [],
    task: [],
    user: [],
  };

  function model(name: ModelName) {
    return {
      count: async () => 0,
      findMany: async (args: FindManyArgs) => {
        calls[name].push(args);
        return rows[name] ?? [];
      },
    };
  }

  return {
    calls,
    prisma: {
      project: model("project"),
      task: model("task"),
      user: model("user"),
    },
  };
}

function makeQuery(overrides: Partial<SearchQueryDto> = {}): SearchQueryDto {
  return { q: "term", ...overrides } as SearchQueryDto;
}

test("projects are scoped to the projects the caller is a member of", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  await service.search(makeQuery({ type: "projects" }), "user-a");

  const where = fake.calls.project[0].where;
  assert.deepEqual(where?.members, { some: { userId: "user-a" } });
});

test("tasks are scoped through their project's membership, not by task id", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  await service.search(makeQuery({ type: "tasks" }), "user-a");

  // On the membership predicate only - the same `project` object also carries
  // the archived filter, which has its own tests below.
  const project = fake.calls.task[0].where?.project as Record<string, unknown>;
  assert.deepEqual(project.members, { some: { userId: "user-a" } });
});

test("users are searched by username only and never by email", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  await service.search(makeQuery({ type: "users" }), "user-a");

  const where = fake.calls.user[0].where ?? {};
  // No membership predicate: finding a user you share no project with is the
  // intended product behaviour, unlike projects and tasks.
  assert.equal(where.members, undefined);
  assert.equal(where.email, undefined);
  assert.equal(where.OR, undefined);
  assert.ok(where.username, "username filter is missing");
  assert.equal(where.status, "ACTIVE");

  // The `where` above only decides WHICH users match; `select` is what decides
  // what leaves the backend about them, and it is the half that actually keeps
  // an email out of a response.
  const select = fake.calls.user[0].select ?? {};
  assert.equal(select.email, undefined, "email must not be selected");
  assert.equal(select.password, undefined);
  assert.deepEqual(Object.keys(select).sort(), [
    "avatarUrl",
    "campus",
    "id",
    "username",
  ]);
});

test("archived projects are excluded by default, and so are their tasks", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  await service.search(makeQuery(), "user-a");

  assert.equal(fake.calls.project[0].where?.isArchived, false);
  // The half that is easy to forget: archiving a project is how you get it out
  // of the way, so its tasks have to leave the results with it - otherwise the
  // Tasks group puts the name of the project you just hid back on screen.
  assert.deepEqual(fake.calls.task[0].where?.project, {
    members: { some: { userId: "user-a" } },
    isArchived: false,
  });
});

test("includeArchived lifts the filter on projects and tasks alike", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  await service.search(makeQuery({ includeArchived: true }), "user-a");

  assert.equal(fake.calls.project[0].where?.isArchived, undefined);
  assert.deepEqual(fake.calls.task[0].where?.project, {
    members: { some: { userId: "user-a" } },
  });
});

test("page 2 skips exactly one page, not two", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  await service.search(
    makeQuery({ type: "projects", page: 2, limit: 10 }),
    "user-a"
  );

  // The classic off-by-one here is `page * limit`, which silently swallows the
  // first page of results.
  assert.equal(fake.calls.project[0].skip, 10);
  assert.equal(fake.calls.project[0].take, 10);
});

test("sort=recent&order=desc orders by updatedAt, with an id tiebreaker", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  await service.search(
    makeQuery({ type: "projects", sort: "recent", order: "desc" }),
    "user-a"
  );

  // The second key is not decoration: without it two rows sharing an updatedAt
  // can swap between pages, so a result appears twice or not at all.
  assert.deepEqual(fake.calls.project[0].orderBy, [
    { updatedAt: "desc" },
    { id: "asc" },
  ]);
});

test("type=all previews every type and queries no page at all", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  // A page and a page size were asked for, but "all" is a preview of three
  // types at once - there is no single list to be on page 3 of, so both are
  // ignored, and the response must say so rather than echo them back.
  const result = await service.search(
    makeQuery({ type: "all", page: 3, limit: 40 }),
    "user-a"
  );

  for (const model of ["project", "task", "user"] as const) {
    assert.equal(fake.calls[model].length, 1, `${model} was not queried`);
    assert.equal(fake.calls[model][0].skip, 0);
    assert.equal(fake.calls[model][0].take, 5);
  }
  assert.equal(result.page, 1, "page must be reported as 1, not echoed back");
  assert.equal(result.limit, 5, "limit must report what was actually applied");
});

test("LIKE wildcards in the term are escaped so it matches literally", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  // Unescaped, "push_swap" would also match "pushXswap" and a bare "%" would
  // match every row in the table - Prisma's `contains` compiles straight to
  // LIKE and passes the term through untouched.
  await service.search(
    makeQuery({ q: "100%_a\\b", type: "projects" }),
    "user-a"
  );

  const or = fake.calls.project[0].where?.OR as {
    name: { contains: string };
  }[];
  assert.equal(or[0].name.contains, "100\\%\\_a\\\\b");
});

test("the echoed query is the raw term, not the escaped one", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  // Escaping is an implementation detail of the SQL filter; the client sent
  // "push_swap" and must see "push_swap" back, ready to render in "Results for".
  const result = await service.search(makeQuery({ q: "push_swap" }), "user-a");

  assert.equal(result.query, "push_swap");
});

test("a type the caller did not ask for is counted but never fetched", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  const result = await service.search(
    makeQuery({ type: "projects" }),
    "user-a"
  );

  assert.equal(fake.calls.task.length, 0);
  assert.equal(fake.calls.user.length, 0);
  // Their totals still come back, which is what keeps the frontend's tab
  // counters honest while only one tab is being paginated.
  assert.equal(result.tasks.total, 0);
  assert.equal(result.users.total, 0);
});

test("a task status is ignored on projects instead of emptying them", async () => {
  const fake = createFakePrisma();
  const service = new SearchService(fake.prisma as never);

  // TODO exists in TaskStatus but not in ProjectStatus. Passing it through
  // would match no project at all and look like "no results" rather than like
  // the ignored filter it is.
  await service.search(
    makeQuery({ type: "projects", status: "TODO" as never }),
    "user-a"
  );

  assert.equal(fake.calls.project[0].where?.status, undefined);
});

test("the project relation is flattened to projectName on task results", async () => {
  const fake = createFakePrisma({
    task: [
      {
        id: "task-1",
        projectId: "project-1",
        title: "Fix login",
        project: { name: "ft_transcendence" },
      },
    ],
  });
  const service = new SearchService(fake.prisma as never);

  const result = await service.search(makeQuery({ type: "tasks" }), "user-a");

  const [item] = result.tasks.items;
  assert.equal(item.projectName, "ft_transcendence");
  // The nested relation object itself must not reach the client.
  assert.equal("project" in item, false);
});
