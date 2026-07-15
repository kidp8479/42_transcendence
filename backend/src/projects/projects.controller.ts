// ProjectsController: handles all HTTP requests under /api/projects
// one method per route - delegates all database work to ProjectsService
// note: :id alone is not enough to authorize GET/PATCH/DELETE - a project id is
// guessable/enumerable like any UUID, so every one of these must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project by id (IDOR).

import { Controller, Get, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // GET /api/projects => all projects the authenticated user is a member of
  // userId comes from req.user.id (auth guard), never from a query param
  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.projectsService.findAll(request.user.id);
  }

  // TODO: POST /api/projects
  //       => create a new project
  //       => expects a request body matching CreateProjectDto (name, description?, status?, deadline?, isArchived?)
  //       => creator (req.user.id) should be added as a ProjectMember right after creation

  // TODO: GET /api/projects/:id
  //       => get one project by its id
  //       => must verify req.user.id is a member of this project before returning it
  //       => validate :id with @Param('id', ParseUUIDPipe) so a malformed id gets
  //          rejected with a 400 before hitting the database

  // TODO: PATCH /api/projects/:id
  //       => update an existing project (any field, all optional)
  //       => expects a request body matching UpdateProjectDto
  //       => must verify req.user.id is a member of this project before updating it

  // TODO: DELETE /api/projects/:id
  //       => delete a project by its id
  //       => must verify req.user.id is a member of this project before deleting it
  //       => no request body needed, the id in the URL is enough (no DTO)
}
