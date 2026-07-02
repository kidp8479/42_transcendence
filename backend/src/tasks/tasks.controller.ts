import { Controller } from "@nestjs/common";

@Controller("tasks")
export class TasksController {
  // TODO: inject TaskService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/task
  //        => create a new task
  //        => expects a request body matching CreateTaskDto (projectId, title, description?, icon?, color?, notes?)
  // GET    /api/task
  //        => get all tasks for a project
  //        => expects ?projectId=... as a URL query param (no request body, no DTO)
  // GET    /api/task/:id
  //        => get one task by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/task/:id
  //        => update an existing task (title, description, or notes)
  //        => expects a request body matching UpdateDiscoveryBlockDto (all fields optional)
  // DELETE /api/task/:id
  //        => delete a task by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
