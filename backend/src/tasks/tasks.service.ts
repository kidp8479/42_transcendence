// TasksService: handles all database operations for Tasks
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma, TaskStatus } from "@prisma/client";
import {
  ApplicationDatabaseTransaction,
  PrismaService,
} from "../prisma/prisma.service";
import type { MachineTaskMutationActor } from "../auth/authenticated-request";
import { ProjectsService } from "../projects/projects.service";
import { RealtimeService } from "../realtime/realtime.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TaskAssigneeService } from "./task-assignees.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

// Backend has no shared import path to the frontend, so this is a short
// hand-kept copy of frontend/src/lib/taskStatusStyles.ts's labels - same
// arrangement as TASK_TITLE_MAX_LENGTH/TASK_NOTES_MAX_LENGTH, which
// tasks.ts's own comment already documents as mirrored by hand.
const statusLabels: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  COMPLETED: "Completed",
};

// shared include so every read path returns the same shape: the category (for
// the card's label and colour) and each assignee's user info (for the avatars).
// Used by delete() too - without it the response is missing category/assignees
// and the frontend's parseTask rejects it as invalid.
const taskInclude = {
  category: true,
  assignees: {
    include: {
      user: {
        select: { id: true, username: true, avatarUrl: true },
      },
    },
  },
};

type TaskWithRelations = Prisma.TaskGetPayload<{
  include: typeof taskInclude;
}>;
type TaskMutationActor =
  { kind: "USER"; userId: string } | MachineTaskMutationActor;
type MachineTaskAction = "CREATE" | "UPDATE" | "DELETE";

// Prisma returns the TaskAssignee join rows, not the users directly - flatten
// each row down to its nested user before sending the response.
function mapTask(task: TaskWithRelations) {
  return {
    ...task,
    assignees: task.assignees.map((assignee) => assignee.user),
  };
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskAssigneeService: TaskAssigneeService,
    private readonly projectsService: ProjectsService,
    private readonly realtimeService: RealtimeService,
    private readonly notificationsService: NotificationsService
  ) {}

  async create(projectId: string, dto: CreateTaskDto, userId: string) {
    return this.createAs(projectId, dto, { kind: "USER", userId });
  }

  async createForMachine(
    projectId: string,
    dto: CreateTaskDto,
    actor: MachineTaskMutationActor
  ) {
    return this.createAs(projectId, dto, actor);
  }

  private async createAs(
    projectId: string,
    dto: CreateTaskDto,
    actor: TaskMutationActor
  ) {
    // Membership first, on its own: an authorization gate, not just another
    // independent check - a non-member shouldn't trigger category/assignee
    // validation at all, in parallel or otherwise.
    if (actor.kind === "USER") {
      await this.projectsService.assertMembership(projectId, actor.userId);
    }
    this.assertValidDateRange(dto.startAt, dto.endAt);
    // Independent of each other once membership holds - no reason to await
    // them one at a time.
    await Promise.all([
      this.assertCategoryBelongsToProject(projectId, dto.categoryId),
      dto.assigneeIds
        ? this.assertAssigneesAreProjectMembers(projectId, dto.assigneeIds)
        : Promise.resolve(),
    ]);

    // Serializable: this counts the column and then writes based on that count,
    // so two concurrent creates on the same column would otherwise both read
    // the same length and land on the same rank.
    const task = await this.prisma.transaction(
      async (database) => {
        // dto.rank is client-supplied; openRankSlot clamps it to
        // 0..columnLength so the invariant doesn't rely on CreateTaskDto's
        // @Min(0) alone.
        const rank = await this.openRankSlot(
          database,
          projectId,
          dto.status,
          dto.rank
        );

        const created = await database.task.create({
          data: {
            title: dto.title,
            categoryId: dto.categoryId,
            status: dto.status,
            priority: dto.priority,
            rank: rank,
            startAt: dto.startAt,
            endAt: dto.endAt,
            description: dto.description,
            notes: dto.notes,
            onCalendar: dto.onCalendar,
            projectId: projectId, // from the url, not the dto
          },
        });
        if (actor.kind === "MACHINE" && dto.assigneeIds) {
          await this.taskAssigneeService.replaceAssigneesInTransaction(
            database,
            created.id,
            projectId,
            dto.assigneeIds
          );
        }
        await this.recordMachineAction(
          database,
          actor,
          projectId,
          created.id,
          "CREATE"
        );
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (dto.assigneeIds) {
      if (actor.kind === "USER") {
        // User-created task ranks are already committed before assignee
        // replacement, preserving the existing user mutation behavior.
        await this.taskAssigneeService.replaceAssignees(
          task.id,
          projectId,
          dto.assigneeIds
        );
      }
      // Everything is "new" on create - no previous assignees to diff against.
      await this.notifyNewAssignees(
        projectId,
        [],
        dto.assigneeIds,
        actor.kind === "USER" ? actor.userId : undefined,
        dto.title
      );
    }
    // Membership already asserted at the top of create() - no need for
    // findById()'s own second check.
    const created = await this.findByIdForProject(task.id, projectId);
    // created carries its own projectId (a real Task field) - the frontend
    // checks it before dispatching. A socket joins every project room a
    // user is a MEMBER of, not just the one they're currently viewing, so
    // without that check a board open in one tab could get corrupted by
    // events from an unrelated project open in another.
    this.realtimeService.emitToProject(projectId, "task:created", created);
    return created;
  }

  async findAll(projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    return this.findAllForProject(projectId);
  }

  // Shared project-scoped read primitive. Its caller must authenticate and
  // authorize a human or project-token principal before reaching it.
  async findAllForProject(projectId: string, limit?: number) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId: projectId },
      include: taskInclude,
      // Postgres guarantees no order without this. Ordering by status first
      // groups each board column together, and the enum sorts in declaration
      // order (TODO, IN_PROGRESS, REVIEW, COMPLETED) - the board's own order.
      orderBy: [{ status: "asc" }, { rank: "asc" }],
      ...(limit === undefined ? {} : { take: limit }),
    });
    return tasks.map(mapTask);
  }

  // also used by update/remove as an access guard: confirms membership and
  // that this task belongs to this project, 404s otherwise
  async findById(id: string, projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    return this.findByIdForProject(id, projectId);
  }

  // Shared project-scoped single-resource read primitive. Keeping projectId
  // in the query prevents a valid token for one project from reading another
  // project's UUID-addressable task.
  async findByIdForProject(id: string, projectId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: id, projectId: projectId },
      include: taskInclude,
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    return mapTask(task);
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    projectId: string,
    userId: string
  ) {
    return this.updateAs(id, dto, projectId, { kind: "USER", userId });
  }

  async updateForMachine(
    id: string,
    dto: UpdateTaskDto,
    projectId: string,
    actor: MachineTaskMutationActor
  ) {
    return this.updateAs(id, dto, projectId, actor);
  }

  private async updateAs(
    id: string,
    dto: UpdateTaskDto,
    projectId: string,
    actor: TaskMutationActor
  ) {
    const existingTask =
      actor.kind === "USER"
        ? await this.findById(id, projectId, actor.userId)
        : await this.findByIdForProject(id, projectId);
    // a PATCH can send only one of startAt/endAt - validate the pair as it will
    // actually end up in the database, not just the field(s) sent. Pure and
    // synchronous, so it runs before the remaining DB round-trips below.
    this.assertValidDateRange(
      dto.startAt ?? existingTask.startAt?.toISOString(),
      dto.endAt ?? existingTask.endAt?.toISOString()
    );
    // assigneeIds isn't a column on Task, handle it separately below.
    // Membership already holds by this point (findById()'s access guard
    // above), so these two are independent of each other - no reason to
    // await them one at a time.
    const assigneeIds = dto.assigneeIds;
    await Promise.all([
      dto.categoryId
        ? this.assertCategoryBelongsToProject(projectId, dto.categoryId)
        : Promise.resolve(),
      assigneeIds
        ? this.assertAssigneesAreProjectMembers(projectId, assigneeIds)
        : Promise.resolve(),
    ]);
    const taskFields = {
      title: dto.title,
      categoryId: dto.categoryId,
      priority: dto.priority,
      startAt: dto.startAt,
      endAt: dto.endAt,
      description: dto.description,
      notes: dto.notes,
      onCalendar: dto.onCalendar,
    };

    const nextStatus = dto.status ?? existingTask.status;
    // Only a real move needs the resequencing below - renaming a task must not
    // drag its whole column through an update.
    const isMoving =
      (dto.status !== undefined && dto.status !== existingTask.status) ||
      (dto.rank !== undefined && dto.rank !== existingTask.rank);

    if (isMoving) {
      // dto.rank is forwarded as-is, undefined included: a status change with no
      // rank means "append to the new column", which moveTask resolves against
      // the live column length inside its transaction. dto.status, not
      // nextStatus: moveTask needs to know whether a status change was
      // actually REQUESTED (vs. just defaulted from a stale pre-transaction
      // read) to resolve the race described in its own comment.
      await this.moveTask(
        id,
        projectId,
        dto.status,
        dto.rank,
        taskFields,
        actor,
        assigneeIds
      );

      // Only a real column change is notification-worthy - a same-column
      // drag (isMoving from a rank change alone) isn't news to anyone.
      // existingTask.assignees is who was assigned BEFORE this PATCH, not
      // whatever assigneeIds (if any) this same request also carries.
      // Title: dto.title if this same PATCH also renamed it, otherwise the
      // notification would quote the stale pre-update title.
      if (dto.status !== undefined && dto.status !== existingTask.status) {
        await this.notifyStatusChange(
          projectId,
          existingTask.assignees,
          actor.kind === "USER" ? actor.userId : undefined,
          dto.title ?? existingTask.title,
          nextStatus
        );
      }
    } else {
      if (actor.kind === "MACHINE") {
        await this.prisma.transaction(
          async (database) => {
            await database.task.update({
              where: { id: id },
              data: taskFields,
            });
            if (assigneeIds) {
              await this.taskAssigneeService.replaceAssigneesInTransaction(
                database,
                id,
                projectId,
                assigneeIds
              );
            }
            await this.recordMachineAction(
              database,
              actor,
              projectId,
              id,
              "UPDATE"
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } else {
        await this.prisma.task.update({
          where: { id: id },
          data: taskFields,
        });
      }
    }

    if (assigneeIds) {
      if (actor.kind === "USER") {
        await this.taskAssigneeService.replaceAssignees(
          id,
          projectId,
          assigneeIds
        );
      }
      // dto.title if this same PATCH also renamed it, same reasoning as
      // notifyStatusChange above.
      const previousAssigneeIds = existingTask.assignees.map(
        (assignee) => assignee.id
      );
      await this.notifyNewAssignees(
        projectId,
        previousAssigneeIds,
        assigneeIds,
        actor.kind === "USER" ? actor.userId : undefined,
        dto.title ?? existingTask.title
      );
      await this.notifyRemovedAssignees(
        projectId,
        previousAssigneeIds,
        assigneeIds,
        actor.kind === "USER" ? actor.userId : undefined,
        dto.title ?? existingTask.title
      );
    }

    // Membership already asserted by findById() at the top of update() -
    // no need for a second check just to build the response.
    const updated = await this.findByIdForProject(id, projectId);
    // Always emitted, moving or not: a single PATCH can change status/rank
    // AND other fields (the drawer sends both together), and task:moved's
    // payload only carries the position - without this, other clients would
    // apply the move but miss the field changes. changes carries the whole
    // task, matching what the frontend's own local dispatch already sends
    // after a save.
    this.realtimeService.emitToProject(projectId, "task:updated", {
      taskId: id,
      projectId: projectId,
      changes: updated,
    });
    return updated;
  }

  async remove(id: string, projectId: string, userId: string) {
    return this.removeAs(id, projectId, { kind: "USER", userId });
  }

  async removeForMachine(
    id: string,
    projectId: string,
    actor: MachineTaskMutationActor
  ) {
    return this.removeAs(id, projectId, actor);
  }

  private async removeAs(
    id: string,
    projectId: string,
    actor: TaskMutationActor
  ) {
    // Access guard only - the position used below comes from the delete itself.
    if (actor.kind === "USER") {
      await this.findById(id, projectId, actor.userId);
    } else {
      await this.findByIdForProject(id, projectId);
    }

    const task = await this.prisma.transaction(
      async (database) => {
        // same include as every other read path - without it the response is
        // missing category/assignees and the frontend rejects it as invalid
        const deleted = await database.task.delete({
          where: { id: id },
          include: taskInclude,
        });
        // Uses delete()'s own returned rank, not findById() above - that ran
        // before the transaction opened and could be stale by now.
        await this.closeRankGap(
          database,
          projectId,
          deleted.status,
          deleted.rank
        );
        await this.recordMachineAction(
          database,
          actor,
          projectId,
          id,
          "DELETE"
        );
        return deleted;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    this.realtimeService.emitToProject(projectId, "task:deleted", {
      taskId: id,
      projectId: projectId,
    });
    return mapTask(task);
  }

  // Shared by remove() and moveTask(): shifts every row after the vacated
  // rank down one, closing the gap and keeping the column dense 0..n-1 -
  // the mirror image of openRankSlot below.
  private async closeRankGap(
    database: ApplicationDatabaseTransaction,
    projectId: string,
    status: TaskStatus,
    vacatedRank: number
  ): Promise<void> {
    await database.task.updateMany({
      where: {
        projectId: projectId,
        status: status,
        rank: { gt: vacatedRank },
      },
      data: { rank: { decrement: 1 } },
    });
  }

  // Shared by create() and moveTask(): clamps wantedRank to the column's
  // current length and shifts every row at or after it down one, keeping
  // ranks dense 0..n-1. excludeId omits the task being moved from its own
  // count/shift (still physically in this column at its old rank) - create()
  // has no such row, so it's left out there. wantedRank undefined = append.
  private async openRankSlot(
    database: ApplicationDatabaseTransaction,
    projectId: string,
    status: TaskStatus,
    wantedRank: number | undefined,
    excludeId?: string
  ): Promise<number> {
    const exclude = excludeId !== undefined ? { id: { not: excludeId } } : {};
    const columnLength = await database.task.count({
      where: { projectId: projectId, status: status, ...exclude },
    });
    const rank =
      wantedRank === undefined
        ? columnLength
        : Math.min(Math.max(wantedRank, 0), columnLength);

    await database.task.updateMany({
      where: {
        projectId: projectId,
        status: status,
        rank: { gte: rank },
        ...exclude,
      },
      data: { rank: { increment: 1 } },
    });

    return rank;
  }

  // Moves a task within/across columns, keeping both columns dense 0..n-1
  // (the invariant tasksReducer.ts assumes). Runs Serializable: it reads the
  // target column's length then writes based on it, so two concurrent drags
  // into the same column would otherwise collide - surfaces as a 409 via the
  // global Prisma filter, client reloads instead of retrying blindly.
  // wantedRank undefined means "append to the new column" - reusing the rank
  // from the old one would drop it somewhere meaningless in the new one.
  private async moveTask(
    id: string,
    projectId: string,
    requestedStatus: TaskStatus | undefined,
    wantedRank: number | undefined,
    taskFields: Prisma.TaskUpdateInput,
    actor: TaskMutationActor,
    assigneeIds: string[] | undefined
  ): Promise<void> {
    // Both depend on the live state read inside the transaction (rank on
    // column length, status on the race above) - reused as-is below for
    // task_moved's payload.
    const result = await this.prisma.transaction(
      async (database) => {
        // Read inside the transaction, not from a findById() before it
        // opened - Serializable only guards what it reads itself, so a
        // concurrent move landing in between used to shift the wrong rows.
        const current = await database.task.findUniqueOrThrow({
          where: { id: id },
          select: { status: true, rank: true },
        });
        // Same reasoning as reading current.rank above: a plain rank-only
        // PATCH (no explicit status) has to stay wherever the task actually,
        // freshly, is - not wherever it was when this request was built.
        // Resolving this from the pre-transaction requestedStatus instead
        // used to let a concurrent status change get silently reverted: this
        // call would still write the stale target column with no error.
        const targetStatus = requestedStatus ?? current.status;

        // 1. close the gap the task leaves in its old column. The task
        //    itself is untouched: it sits at its current rank, and this
        //    only shifts what's strictly after it.
        await this.closeRankGap(
          database,
          projectId,
          current.status,
          current.rank
        );

        // 2-3. clamp inside the target column as it stands WITHOUT this task
        //    (dropping past the last card appends instead of leaving a hole)
        //    and open a slot there - excluding this task matters for a
        //    same-column move, where it is still sitting in this column.
        const nextRank = await this.openRankSlot(
          database,
          projectId,
          targetStatus,
          wantedRank,
          id
        );

        // 4. drop the task into the slot, with the rest of the PATCH's fields
        await database.task.update({
          where: { id: id },
          data: { ...taskFields, status: targetStatus, rank: nextRank },
        });
        if (actor.kind === "MACHINE" && assigneeIds) {
          await this.taskAssigneeService.replaceAssigneesInTransaction(
            database,
            id,
            projectId,
            assigneeIds
          );
        }
        await this.recordMachineAction(
          database,
          actor,
          projectId,
          id,
          "UPDATE"
        );

        return { nextRank, targetStatus };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Covers both drag-and-drop and a drawer status change - moveTask's only
    // call site. No sender exclusion: task_moved is idempotent (see
    // tasksReducer.ts), so the acting client just re-applies its own move.
    this.realtimeService.emitToProject(projectId, "task:moved", {
      taskId: id,
      projectId: projectId,
      toStatus: result.targetStatus,
      toIndex: result.nextRank,
    });
  }

  // Notifies a task's assignees when it changes column, same shape as
  // CalendarEventsService.notifyNewAssignees but a different trigger (a
  // status change, not a new assignee). Excludes whoever made the move -
  // you don't need to be told about your own action.
  private async notifyStatusChange(
    projectId: string,
    assignees: { id: string }[],
    actingUserId: string | undefined,
    taskTitle: string,
    nextStatus: TaskStatus
  ): Promise<void> {
    const recipientIds = assignees
      .map((assignee) => assignee.id)
      .filter((assigneeId) => assigneeId !== actingUserId);
    if (recipientIds.length === 0) {
      return;
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true },
    });
    const message = `Task "${taskTitle}" moved to ${statusLabels[nextStatus]} in "${project.name}"`;

    await Promise.all(
      recipientIds.map((recipientId) =>
        this.notificationsService.create(
          recipientId,
          message,
          `/${projectId}/kanban`
        )
      )
    );
  }

  // Same shape as CalendarEventsService.notifyNewAssignees: notifies whoever
  // was newly added to a task's assignee list, excluding self-assignment.
  // previousAssigneeIds is [] on create() (everything is "new"); on update()
  // it's the task's assignees BEFORE this PATCH, fetched before
  // replaceAssignees wipes the join rows.
  private async notifyNewAssignees(
    projectId: string,
    previousAssigneeIds: string[],
    newAssigneeIds: string[],
    actingUserId: string | undefined,
    taskTitle: string
  ): Promise<void> {
    const addedUserIds = newAssigneeIds.filter(
      (assigneeId) =>
        !previousAssigneeIds.includes(assigneeId) && assigneeId !== actingUserId
    );
    if (addedUserIds.length === 0) {
      return;
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true },
    });
    const message = `You were assigned to "${taskTitle}" in "${project.name}"`;

    await Promise.all(
      addedUserIds.map((addedUserId) =>
        this.notificationsService.create(
          addedUserId,
          message,
          `/${projectId}/kanban`
        )
      )
    );
  }

  // Mirror of notifyNewAssignees for the other direction - notifies whoever
  // was dropped from a task's assignee list on this PATCH. Only ever called
  // from update(): create()'s previousAssigneeIds is always [], so nothing
  // to remove.
  private async notifyRemovedAssignees(
    projectId: string,
    previousAssigneeIds: string[],
    newAssigneeIds: string[],
    actingUserId: string,
    taskTitle: string
  ): Promise<void> {
    const removedUserIds = previousAssigneeIds.filter(
      (assigneeId) =>
        !newAssigneeIds.includes(assigneeId) && assigneeId !== actingUserId
    );
    if (removedUserIds.length === 0) {
      return;
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true },
    });
    const message = `You were removed from "${taskTitle}" in "${project.name}"`;

    await Promise.all(
      removedUserIds.map((removedUserId) =>
        this.notificationsService.create(
          removedUserId,
          message,
          `/${projectId}/kanban`
        )
      )
    );
  }

  // Both dates are optional on a Task (unlike a calendar event), so this only
  // has something to check when the task ends up with both.
  private assertValidDateRange(
    startAt?: string | null,
    endAt?: string | null
  ): void {
    if (!startAt || !endAt) {
      return;
    }
    if (new Date(endAt) < new Date(startAt)) {
      throw new BadRequestException("endAt must not be before startAt");
    }
  }

  // categoryId comes from the body, so it could point at a category from a
  // different project - check it belongs here before using it
  private async assertCategoryBelongsToProject(
    projectId: string,
    categoryId: string
  ): Promise<void> {
    const category = await this.prisma.taskCategory.findFirst({
      where: { id: categoryId, projectId: projectId },
    });
    if (!category) {
      throw new BadRequestException(
        "categoryId does not belong to this project"
      );
    }
  }

  // same idea for assignees: the DTO only checks each id is a UUID, not that
  // it belongs to a real member of this project
  private async assertAssigneesAreProjectMembers(
    projectId: string,
    userIds: string[]
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    const memberCount = await this.prisma.projectMember.count({
      where: { projectId: projectId, userId: { in: userIds } },
    });
    if (memberCount !== userIds.length) {
      throw new BadRequestException(
        "assigneeIds must all be members of this project"
      );
    }
  }

  private async recordMachineAction(
    database: ApplicationDatabaseTransaction,
    actor: TaskMutationActor,
    projectId: string,
    taskId: string,
    action: MachineTaskAction
  ): Promise<void> {
    if (actor.kind !== "MACHINE") {
      return;
    }
    await database.$executeRaw(
      Prisma.sql`INSERT INTO "MachineTaskActionAudit" ("id", "tokenId", "projectId", "taskId", "action") VALUES (${randomUUID()}, ${actor.tokenId}, ${projectId}, ${taskId}, ${action})`
    );
  }
}
