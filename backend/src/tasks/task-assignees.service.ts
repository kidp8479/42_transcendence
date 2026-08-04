// TaskAssigneeService: manages the TaskAssignee join table (which users are assigned to a task)
// no controller, no module of its own - injected directly into TasksService, since assignees
// are only ever set through the assigneeIds array on CreateTaskDto/UpdateTaskDto, never their
// own standalone endpoint (unlike ProjectMember, which needs one - see project-members module)
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TaskAssigneeService {
  constructor(private readonly prisma: PrismaService) {}

  // Wipes the task's current assignees and inserts the new list, in one
  // transaction: between the delete and the insert the task has no assignees at
  // all, so without it a failure halfway through would silently drop every
  // member instead of leaving the old set in place.
  //
  // Replace rather than diff on purpose: the frontend sends the full desired
  // set (its member picker is a row of toggles), not "add X, remove Y", and
  // these rows carry no data of their own worth preserving. It also sidesteps
  // the @@unique([userId, taskId]) constraint, which a naive insert-only
  // approach would trip on any already-assigned user.
  //
  // TasksService.assertAssigneesAreProjectMembers already checked this before
  // calling in - kept there for a fast, clear 400 in the common case without
  // paying for a transaction first. That check runs outside any transaction
  // though, so a membership change (removeMember) landing between it and this
  // call would go undetected - the same TOCTOU family as the rank race
  // already fixed in moveTask(). Re-checking here, fresh, inside the same
  // transaction that performs the write, is what actually closes it.
  async replaceAssignees(
    taskId: string,
    projectId: string,
    userIds: string[]
  ): Promise<void> {
    await this.prisma.transaction(async (transactionPrisma) => {
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
          data: userIds.map((userId) => ({ userId: userId, taskId: taskId })),
        });
      }
    });
  }
}
