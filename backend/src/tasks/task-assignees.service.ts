// TaskAssigneeService: manages the TaskAssignee join table (which users are assigned to a task)
// no controller, no module of its own - injected directly into TasksService, since assignees
// are only ever set through the assigneeIds array on CreateTaskDto/UpdateTaskDto, never their
// own standalone endpoint (unlike ProjectMember, which needs one - see project-members module)
import { Injectable } from "@nestjs/common";

@Injectable()
export class TaskAssigneeService {
  // TODO: inject PrismaService here via constructor
  // TODO: replaceAssignees(taskId: string, userIds: string[])
  //       => called by TasksService on create/update: deletes existing TaskAssignee rows
  //          for this task, then inserts one row per userId in the new list
}
