// ProjectsController: handles all HTTP requests under /api/projects
// one method per route - delegates all database work to ProjectsService
// note: when implementing, validate :id with @Param('id', ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database

import { Controller } from "@nestjs/common";

@Controller("projects")
export class ProjectsController {
  // TODO: inject ProjectsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects
  //        => create a new project
  //        => expects a request body matching CreateProjectDto (name, description?, status?, deadline?, isArchived?)
  // GET    /api/projects
  //        => get all projects for the current user
  //        => no request body, no DTO
  // GET    /api/projects/:id
  //        => get one project by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/projects/:id
  //        => update an existing project (any field, all optional)
  //        => expects a request body matching UpdateProjectDto
  // DELETE /api/projects/:id
  //        => delete a project by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
