// TaskAssigneeService: manages the TaskAssignee join table (which users are assigned to a task)
// no controller, no module of its own - injected directly into TasksService, since assignees
// are only ever set through the assigneeIds array on CreateTaskDto/UpdateTaskDto, never their
// own standalone endpoint (unlike ProjectMember, which needs one - see project-members module)
import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TaskAssigneeService {
  constructor(private readonly prisma: PrismaService) {}

  // Wipes the task's current assignees and inserts the new list, in one
  // transaction - otherwise a failure between delete and insert would
  // silently drop every assignee instead of leaving the old set in place.
  //
  // Replace, not diff: the frontend sends the full desired set (a row of
  // toggles), and this sidesteps the @@unique([userId, taskId]) constraint
  // a naive insert-only approach would trip on an already-assigned user.
  //
  // TasksService.assertAssigneesAreProjectMembers already checked this
  // before calling in, for a fast 400 without paying for a transaction
  // first - but that check runs outside any transaction, so a membership
  // change landing in the gap would go undetected (same TOCTOU family as
  // the rank race in moveTask()). Re-checking fresh, inside this same
  // transaction, is what actually closes it - Serializable, matching the
  // other rank/membership transactions in tasks.service.ts, since the
  // default ReadCommitted only guarantees each statement its own snapshot,
  // not the whole transaction against a concurrent removal landing between
  // the count and the insert.
  async replaceAssignees(
    taskId: string,
    projectId: string,
    userIds: string[]
  ): Promise<void> {
    await this.prisma.transaction(
      async (transactionPrisma) => {
        if (userIds.length > 0) {
          const memberCount = await transactionPrisma.projectMember.count({
            where: { projectId: projectId, userId: { in: userIds } },
          });
          if (memberCount !== userIds.length) {
            throw new BadRequestException(
              "assigneeIds must all be members of this project"
            );
          }
        }

        await transactionPrisma.taskAssignee.deleteMany({
          where: { taskId: taskId },
        });
        if (userIds.length > 0) {
          await transactionPrisma.taskAssignee.createMany({
            data: userIds.map((userId) => ({
              userId: userId,
              taskId: taskId,
            })),
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
