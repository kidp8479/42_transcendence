// TasksService: handles all database operations for Tasks
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TaskStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { TaskAssigneeService } from "./task-assignees.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

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
    private readonly projectsService: ProjectsService
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
        // Clamp both ends: dto.rank is a client-supplied position, and anything
        // outside 0..columnLength would leave a hole in the 0..n-1 sequence.
        // CreateTaskDto's @Min(0) already rejects negatives over HTTP, but the
        // invariant shouldn't depend on a validation decorator staying put -
        // moveTask() clamps the same way.
        const columnLength = await database.task.count({
          where: { projectId: projectId, status: dto.status },
        });
        const rank = Math.min(Math.max(dto.rank, 0), columnLength);

        await database.task.updateMany({
          where: {
            projectId: projectId,
            status: dto.status,
            rank: { gte: rank },
          },
          data: { rank: { increment: 1 } },
        });

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
      await this.taskAssigneeService.replaceAssignees(task.id, dto.assigneeIds);
    }

    return this.findById(task.id, projectId, userId);
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
      await this.moveTask(
        id,
        projectId,
        existingTask.status,
        existingTask.rank,
        nextStatus,
        dto.rank ?? existingTask.rank,
        taskFields
      );
    } else {
      await this.prisma.task.update({
        where: { id: id },
        data: taskFields,
      });
    }

    if (assigneeIds) {
      await this.taskAssigneeService.replaceAssignees(id, assigneeIds);
    }

    return this.findById(id, projectId, userId);
  }

  async remove(id: string, projectId: string, userId: string) {
    const existingTask = await this.findById(id, projectId, userId); // access guard

    const task = await this.prisma.transaction(
      async (database) => {
        // same include as every other read path - without it the response is
        // missing category/assignees and the frontend rejects it as invalid
        const deleted = await database.task.delete({
          where: { id: id },
          include: taskInclude,
        });
        // close the gap the deleted task leaves behind, so the column stays
        // dense 0..n-1
        await database.task.updateMany({
          where: {
            projectId: projectId,
            status: existingTask.status,
            rank: { gt: existingTask.rank },
          },
          data: { rank: { decrement: 1 } },
        });
        return deleted;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return mapTask(task);
  }

  // Moves a task within or across status columns, keeping BOTH columns dense
  // 0..n-1 - the invariant the board's reducer (lib/tasksReducer.ts) assumes.
  //
  // The whole thing runs Serializable because it reads the target column's
  // length and then writes based on it: two people dragging into the same
  // column at once would otherwise both compute the same slot. A conflict
  // surfaces as P2034, which the global Prisma filter maps to 409 - the client
  // reloads rather than retrying blindly.
  private async moveTask(
    id: string,
    projectId: string,
    fromStatus: TaskStatus,
    fromRank: number,
    toStatus: TaskStatus,
    wantedRank: number,
    taskFields: Prisma.TaskUpdateInput
  ): Promise<void> {
    await this.prisma.transaction(
      async (database) => {
        // 1. close the gap the task leaves in its old column. The task itself
        //    is untouched: it sits at fromRank, and this only shifts what's
        //    strictly after it.
        await database.task.updateMany({
          where: {
            projectId: projectId,
            status: fromStatus,
            rank: { gt: fromRank },
          },
          data: { rank: { decrement: 1 } },
        });

        // 2. clamp inside the target column as it stands WITHOUT this task, so
        //    dropping past the last card appends instead of leaving a hole.
        const columnLength = await database.task.count({
          where: {
            projectId: projectId,
            status: toStatus,
            id: { not: id },
          },
        });
        const nextRank = Math.min(Math.max(wantedRank, 0), columnLength);

        // 3. open a slot at that position. Excluding this task matters for a
        //    same-column move, where it is still sitting in this column.
        await database.task.updateMany({
          where: {
            projectId: projectId,
            status: toStatus,
            rank: { gte: nextRank },
            id: { not: id },
          },
          data: { rank: { increment: 1 } },
        });

        // 4. drop the task into the slot, with the rest of the PATCH's fields
        await database.task.update({
          where: { id: id },
          data: { ...taskFields, status: toStatus, rank: nextRank },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
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
