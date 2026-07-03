// TaskCategoriesController: handles all HTTP requests under /api/projects/:projectId/task-categories
// one method per route - delegates all database work to TaskCategoriesService
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/task-categories")
export class TaskCategoriesController {
  // TODO: inject TaskCategoriesService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/task-categories
  //        => create a new task category for this project
  //        => expects a request body matching CreateTaskCategoryDto (name, color)
  //        => projectId comes from the URL, not the body
  // GET    /api/projects/:projectId/task-categories
  //        => get all task categories for a project
  //        => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  // GET    /api/projects/:projectId/task-categories/:id
  //        => get one task category by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/projects/:projectId/task-categories/:id
  //        => update a task category (name or color)
  //        => expects a request body matching UpdateTaskCategoryDto (all fields optional)
  // DELETE /api/projects/:projectId/task-categories/:id
  //        => delete a task category by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)
}
