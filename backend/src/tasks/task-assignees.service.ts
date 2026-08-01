// TaskAssigneeService: manages the TaskAssignee join table (which users are assigned to a task)
// no controller, no module of its own - injected directly into TasksService, since assignees
// are only ever set through the assigneeIds array on CreateTaskDto/UpdateTaskDto, never their
// own standalone endpoint (unlike ProjectMember, which needs one - see project-members module)
import { Injectable } from "@nestjs/common";
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
  async replaceAssignees(taskId: string, userIds: string[]): Promise<void> {
    await this.prisma.transaction(async (transactionPrisma) => {
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
