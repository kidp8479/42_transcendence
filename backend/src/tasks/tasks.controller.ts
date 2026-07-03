// TasksController: handles all HTTP requests under /api/projects/:projectId/tasks
// one method per route - delegates all database work to TasksService
// note: projectId always comes from the URL, never from the request body
// note: categoryId and assigneeIds stay in the body (they are relations, not the parent scope)
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/tasks")
export class TasksController {
  // TODO: inject TasksService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/tasks
  //        => create a new task
  //        => expects a request body matching CreateTaskDto (title, categoryId, status,
  //           priority, startAt?, endAt?, description?, notes?, onCalendar, assigneeIds?)
  //        => projectId comes from the URL, not the body
  //        => categoryId stays in the body (it's a relation, not the parent scope)
  //        => onCalendar decides whether the task also shows up on the calendar tab
  //        => assigneeIds, if provided, are handled internally via TaskAssigneeService
  // GET    /api/projects/:projectId/tasks
  //        => get all tasks for a project
  //        => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  // GET    /api/projects/:projectId/tasks/:id
  //        => get one task by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/projects/:projectId/tasks/:id
  //        => update an existing task (any field, all optional)
  //        => expects a request body matching UpdateTaskDto
  // DELETE /api/projects/:projectId/tasks/:id
  //        => delete a task by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)
}
