// TasksService: handles all database operations for Tasks
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TaskStatus } from "@prisma/client";
import {
  ApplicationDatabaseTransaction,
  PrismaService,
} from "../prisma/prisma.service";
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
    await this.projectsService.assertMembership(projectId, userId);
    this.assertValidDateRange(dto.startAt, dto.endAt);
    await this.assertCategoryBelongsToProject(projectId, dto.categoryId);
    if (dto.assigneeIds) {
      await this.assertAssigneesAreProjectMembers(projectId, dto.assigneeIds);
    }

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

        return database.task.create({
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Outside the transaction above, like CalendarEventsService does: the join
    // rows aren't part of the ordering invariant, so a failure here leaves a
    // correctly-ranked task with no assignees rather than a corrupt column.
    if (dto.assigneeIds) {
      await this.taskAssigneeService.replaceAssignees(
        task.id,
        projectId,
        dto.assigneeIds
      );
      // Everything is "new" on create - no previous assignees to diff against.
      await this.notifyNewAssignees(
        projectId,
        [],
        dto.assigneeIds,
        userId,
        dto.title
      );
    }

    // Membership already asserted at the top of create() - no need for
    // findById()'s own second check.
    const created = await this.getTaskOrThrow(task.id, projectId);
    this.realtimeService.emitToProject(projectId, "task:created", created);
    return created;
  }

  async findAll(projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    const tasks = await this.prisma.task.findMany({
      where: { projectId: projectId },
      include: taskInclude,
      // Postgres guarantees no order without this. Ordering by status first
      // groups each board column together, and the enum sorts in declaration
      // order (TODO, IN_PROGRESS, REVIEW, COMPLETED) - the board's own order.
      orderBy: [{ status: "asc" }, { rank: "asc" }],
    });
    return tasks.map(mapTask);
  }

  // also used by update/remove as an access guard: confirms membership and
  // that this task belongs to this project, 404s otherwise
  async findById(id: string, projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    return this.getTaskOrThrow(id, projectId);
  }

  // findById's read half, without the membership check - for callers that
  // already asserted membership earlier in the same request.
  private async getTaskOrThrow(id: string, projectId: string) {
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
    const existingTask = await this.findById(id, projectId, userId); // access guard
    // a PATCH can send only one of startAt/endAt - validate the pair as it will
    // actually end up in the database, not just the field(s) sent. Pure and
    // synchronous, so it runs before the remaining DB round-trips below.
    this.assertValidDateRange(
      dto.startAt ?? existingTask.startAt?.toISOString(),
      dto.endAt ?? existingTask.endAt?.toISOString()
    );
    if (dto.categoryId) {
      await this.assertCategoryBelongsToProject(projectId, dto.categoryId);
    }

    // assigneeIds isn't a column on Task, handle it separately below
    const assigneeIds = dto.assigneeIds;
    if (assigneeIds) {
      await this.assertAssigneesAreProjectMembers(projectId, assigneeIds);
    }
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
      // the live column length inside its transaction.
      await this.moveTask(id, projectId, nextStatus, dto.rank, taskFields);

      // Only a real column change is notification-worthy - a same-column
      // drag (isMoving from a rank change alone) isn't news to anyone.
      // existingTask.assignees is who was assigned BEFORE this PATCH, not
      // whatever assigneeIds (if any) this same request also carries.
      if (dto.status !== undefined && dto.status !== existingTask.status) {
        await this.notifyStatusChange(
          projectId,
          existingTask.assignees,
          userId,
          existingTask.title,
          nextStatus
        );
      }
    } else {
      await this.prisma.task.update({
        where: { id: id },
        data: taskFields,
      });
    }

    if (assigneeIds) {
      await this.taskAssigneeService.replaceAssignees(
        id,
        projectId,
        assigneeIds
      );
      await this.notifyNewAssignees(
        projectId,
        existingTask.assignees.map((assignee) => assignee.id),
        assigneeIds,
        userId,
        existingTask.title
      );
    }

    // Membership already asserted by findById() at the top of update() -
    // no need for a second check just to build the response.
    const updated = await this.getTaskOrThrow(id, projectId);
    // A moving update already broadcast task:moved above - this covers the
    // rest (fields-only edits). changes carries the whole task, matching
    // what the frontend's own local dispatch already sends after a save.
    if (!isMoving) {
      this.realtimeService.emitToProject(projectId, "task:updated", {
        taskId: id,
        changes: updated,
      });
    }
    return updated;
  }

  async remove(id: string, projectId: string, userId: string) {
    // Access guard only - the position used below comes from the delete itself.
    await this.findById(id, projectId, userId);

    const task = await this.prisma.transaction(
      async (database) => {
        // same include as every other read path - without it the response is
        // missing category/assignees and the frontend rejects it as invalid
        const deleted = await database.task.delete({
          where: { id: id },
          include: taskInclude,
        });
        // Closes the gap left behind, keeping the column dense 0..n-1. Uses
        // delete()'s own returned rank, not findById() above - that ran
        // before the transaction opened and could be stale by now.
        await database.task.updateMany({
          where: {
            projectId: projectId,
            status: deleted.status,
            rank: { gt: deleted.rank },
          },
          data: { rank: { decrement: 1 } },
        });
        return deleted;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    this.realtimeService.emitToProject(projectId, "task:deleted", {
      taskId: id,
    });
    return mapTask(task);
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
    toStatus: TaskStatus,
    wantedRank: number | undefined,
    taskFields: Prisma.TaskUpdateInput
  ): Promise<void> {
    // nextRank depends on the live column length, computed inside the
    // transaction, then reused as-is below for task_moved's toIndex.
    const nextRank = await this.prisma.transaction(
      async (database) => {
        // Read inside the transaction, not from a findById() before it
        // opened - Serializable only guards what it reads itself, so a
        // concurrent move landing in between used to shift the wrong rows.
        const current = await database.task.findUniqueOrThrow({
          where: { id: id },
          select: { status: true, rank: true },
        });

        // 1. close the gap the task leaves in its old column. The task itself
        //    is untouched: it sits at its current rank, and this only shifts
        //    what's strictly after it.
        await database.task.updateMany({
          where: {
            projectId: projectId,
            status: current.status,
            rank: { gt: current.rank },
          },
          data: { rank: { decrement: 1 } },
        });

        // 2-3. clamp inside the target column as it stands WITHOUT this task
        //    (dropping past the last card appends instead of leaving a hole)
        //    and open a slot there - excluding this task matters for a
        //    same-column move, where it is still sitting in this column.
        const nextRank = await this.openRankSlot(
          database,
          projectId,
          toStatus,
          wantedRank,
          id
        );

        // 4. drop the task into the slot, with the rest of the PATCH's fields
        await database.task.update({
          where: { id: id },
          data: { ...taskFields, status: toStatus, rank: nextRank },
        });

        return nextRank;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Covers both drag-and-drop and a drawer status change - moveTask's only
    // call site. No sender exclusion: task_moved is idempotent (see
    // tasksReducer.ts), so the acting client just re-applies its own move.
    this.realtimeService.emitToProject(projectId, "task:moved", {
      taskId: id,
      toStatus,
      toIndex: nextRank,
    });
  }

  // Notifies a task's assignees when it changes column, same shape as
  // CalendarEventsService.notifyNewAssignees but a different trigger (a
  // status change, not a new assignee). Excludes whoever made the move -
  // you don't need to be told about your own action.
  private async notifyStatusChange(
    projectId: string,
    assignees: { id: string }[],
    actingUserId: string,
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
    actingUserId: string,
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
}
