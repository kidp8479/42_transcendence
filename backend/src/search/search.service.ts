// SearchService: one cross-project search over the data the caller is actually
// allowed to see. Read-only, so no transaction - three independent counts plus
// up to three independent page queries, all issued at once.
//
// The three `where` predicates below are the security boundary of this whole
// feature. ProjectsService.assertMembership - the guard every other module
// calls - is per-project and therefore the wrong tool here: it would mean one
// query per project. These predicates express the same rule set-wise instead,
// in a single query each.

import { Injectable } from "@nestjs/common";
import {
  AccountStatus,
  Prisma,
  ProjectStatus,
  TaskStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  SearchQueryDto,
  type SearchOrder,
  type SearchSort,
  type SearchType,
} from "./dto/search-query.dto";
import { SEARCH_DEFAULT_LIMIT, SEARCH_PREVIEW_LIMIT } from "./search.constants";

// `select`, never `include`, on all three: an explicit column list is what
// guarantees User.email cannot leave the backend by accident.
const projectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  isArchived: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  updatedAt: true,
  // A task title out of context means nothing - "Fix login" in which project?
  // Flattened to `projectName` below, the way TasksService.mapTask flattens its
  // assignees, so the client never receives a nested relation object.
  project: { select: { name: true } },
} satisfies Prisma.TaskSelect;

const userSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  campus: true,
} satisfies Prisma.UserSelect;

type TaskSearchRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQueryDto, userId: string) {
    // Defaults are resolved exactly once, here, and echoed back in the response
    // so a caller never has to guess what the server actually applied.
    const term = query.q;
    const type: SearchType = query.type ?? "all";
    const sort: SearchSort = query.sort ?? "name";
    const order: SearchOrder = query.order ?? "asc";
    const includeArchived = query.includeArchived ?? false;
    // "all" is a short preview of every type at once, not a list you can be on
    // page 3 of. Both values are pinned rather than echoed back untouched, so
    // the response always states what the query actually did.
    const page = type === "all" ? 1 : (query.page ?? 1);
    const limit =
      type === "all"
        ? SEARCH_PREVIEW_LIMIT
        : (query.limit ?? SEARCH_DEFAULT_LIMIT);

    const contains = {
      contains: escapeLikeWildcards(term),
      mode: Prisma.QueryMode.insensitive,
    };

    const projectWhere: Prisma.ProjectWhereInput = {
      // The caller sees a project only by being a member of it - the exact
      // predicate ProjectsService.findAll uses. Drop this line and the search
      // hands every project in the database to anyone with an account.
      members: { some: { userId } },
      OR: [{ name: contains }, { description: contains }],
      // Same default as the Projects page, which hides archived projects behind
      // a toggle rather than showing them in the main list.
      ...(includeArchived ? {} : { isArchived: false }),
      ...(type === "projects" && isProjectStatus(query.status)
        ? { status: query.status }
        : {}),
    };

    const taskWhere: Prisma.TaskWhereInput = {
      // Same rule one hop further out: a task is visible through its project.
      project: { members: { some: { userId } } },
      OR: [{ title: contains }, { description: contains }],
      ...(type === "tasks" && isTaskStatus(query.status)
        ? { status: query.status }
        : {}),
    };

    const userWhere: Prisma.UserWhereInput = {
      // Deliberately NOT scoped to shared projects: any registered member is
      // findable by username, whether or not you have ever worked with them.
      // Matching on username only - never email - so an account cannot be used
      // to test whether a given address is registered.
      username: contains,
      // A disabled or not-yet-approved account is not someone you can reach.
      status: AccountStatus.ACTIVE,
    };

    // Which rows to actually fetch for a given type: a short preview when the
    // caller asked for everything, the requested page on the active type, and
    // nothing at all for the types they didn't ask for - those still report a
    // correct `total`, it just comes from the count instead of from the rows.
    const sliceFor = (candidate: SearchType) => {
      if (type === "all") {
        return { skip: 0, take: limit };
      }
      return type === candidate
        ? { skip: (page - 1) * limit, take: limit }
        : null;
    };

    const projectSlice = sliceFor("projects");
    const taskSlice = sliceFor("tasks");
    const userSlice = sliceFor("users");

    // The `id` tiebreaker in every orderBy is not cosmetic: without it two rows
    // sharing a name can swap places between two queries, so a result shows up
    // on both page 1 and page 2 or on neither. Postgres guarantees no ordering
    // beyond the keys you actually name.
    const [projectTotal, taskTotal, userTotal, projects, tasks, users] =
      await Promise.all([
        this.prisma.project.count({ where: projectWhere }),
        this.prisma.task.count({ where: taskWhere }),
        this.prisma.user.count({ where: userWhere }),
        projectSlice
          ? this.prisma.project.findMany({
              where: projectWhere,
              select: projectSelect,
              orderBy:
                sort === "name"
                  ? [{ name: order }, { id: "asc" }]
                  : [{ updatedAt: order }, { id: "asc" }],
              ...projectSlice,
            })
          : [],
        taskSlice
          ? this.prisma.task.findMany({
              where: taskWhere,
              select: taskSelect,
              orderBy:
                sort === "name"
                  ? [{ title: order }, { id: "asc" }]
                  : [{ updatedAt: order }, { id: "asc" }],
              ...taskSlice,
            })
          : [],
        userSlice
          ? this.prisma.user.findMany({
              where: userWhere,
              select: userSelect,
              orderBy:
                sort === "name"
                  ? [{ username: order }, { id: "asc" }]
                  : [{ updatedAt: order }, { id: "asc" }],
              ...userSlice,
            })
          : [],
      ]);

    return {
      query: term,
      type,
      sort,
      order,
      page,
      limit,
      projects: { items: projects, total: projectTotal },
      tasks: { items: tasks.map(flattenTaskProject), total: taskTotal },
      users: { items: users, total: userTotal },
    };
  }
}

// Prisma's `contains` compiles to SQL LIKE/ILIKE and passes the term through
// untouched, so % and _ keep their wildcard meaning: "100%" quietly matches far
// more than it should, a bare "%%" matches every row in the table, and this
// app's own "push_swap" matches "pushXswap" too. Escaping them - and the escape
// character itself, first, or it would double-escape the ones added below -
// makes the term match literally. Not an injection (the value is still bound as
// a parameter), just the wrong results.
function escapeLikeWildcards(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}

function flattenTaskProject(task: TaskSearchRow) {
  const { project, ...rest } = task;
  return { ...rest, projectName: project.name };
}

// `status` accepts values from two different enums (the DTO validates against
// their union), so each type checks whether the value is one of its own before
// applying it. Without these, a TaskStatus like TODO would reach a Project
// filter, match nothing, and silently return an empty list instead of an error.
function isProjectStatus(value: unknown): value is ProjectStatus {
  return Object.values(ProjectStatus).includes(value as ProjectStatus);
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}
