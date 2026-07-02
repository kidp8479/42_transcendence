// TasksController: handles all HTTP requests under /api/tasks
// one method per route - delegates all database work to TasksService
// note: there is currently no projectId in the URL nor in CreateTaskDto - how a task gets
// scoped to a project (via categoryId, which does have a projectId, or via the URL) is not
// decided yet, flag this with the team before implementing the real routes

import { Controller } from "@nestjs/common";

@Controller("tasks")
export class TasksController {
  // TODO: inject TasksService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/tasks
  //        => create a new task
  //        => expects a request body matching CreateTaskDto (title, categoryId, status,
  //           priority, startAt?, endAt?, description?, notes?, onCalendar, assigneeIds?)
  //        => onCalendar decides whether the task also shows up on the calendar tab -
  //           see the onCalendar field discussion for why it's allowed at creation time
  //        => assigneeIds, if provided, are handled internally via TaskAssigneeService
  // GET    /api/tasks
  //        => get all tasks for a project
  //        => expects ?categoryId=... or ?projectId=... as a URL query param (TBD which - see note above)
  // GET    /api/tasks/:id
  //        => get one task by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/tasks/:id
  //        => update an existing task (any field, all optional)
  //        => expects a request body matching UpdateTaskDto
  // DELETE /api/tasks/:id
  //        => delete a task by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
