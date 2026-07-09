// ProjectsController: handles all HTTP requests under /api/projects
// one method per route - delegates all database work to ProjectsService
// note: when implementing, validate :id with @Param('id', ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :id alone is not enough to authorize GET/PATCH/DELETE - a project id is
// guessable/enumerable like any UUID, so every one of these must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project by id (IDOR).

import { Controller } from "@nestjs/common";

@Controller("projects")
export class ProjectsController {
  // TODO: inject ProjectsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects
  //        => create a new project
  //        => expects a request body matching CreateProjectDto (name, description?, status?, deadline?, isArchived?)
  //        => creator (req.user.id) should be added as a ProjectMember right after creation
  // GET    /api/projects
  //        => get all projects the authenticated user is a member of
  //        => userId comes from req.user.id (auth guard), never from a query param
  // GET    /api/projects/:id
  //        => get one project by its id
  //        => must verify req.user.id is a member of this project before returning it
  // PATCH  /api/projects/:id
  //        => update an existing project (any field, all optional)
  //        => expects a request body matching UpdateProjectDto
  //        => must verify req.user.id is a member of this project before updating it
  // DELETE /api/projects/:id
  //        => delete a project by its id
  //        => must verify req.user.id is a member of this project before deleting it
  //        => no request body needed, the id in the URL is enough (no DTO)
}
