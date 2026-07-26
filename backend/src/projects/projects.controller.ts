// ProjectsController: handles all HTTP requests under /api/projects
// one method per route - delegates all database work to ProjectsService
// note: :id alone is not enough to authorize GET/PATCH/DELETE - a project id is
// guessable/enumerable like any UUID, so every one of these must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project by id (IDOR).

import {
  Controller,
  Get,
  Req,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Delete,
  Patch,
  HttpCode,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // GET /api/projects => all projects the authenticated user is a member of
  // userId comes from req.user.id (auth guard), never from a query param
  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.projectsService.findAll(request.user.id);
  }

  // GET /api/projects/:id => one project, only if the user is a member of it
  // (membership enforced inside ProjectsService.findById, not trusted here)
  @Get(":id")
  findById(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectsService.findById(id, request.user.id);
  }

  // POST /api/projects => create a project; the caller becomes its first member (ADMIN)
  @Post()
  create(@Body() dto: CreateProjectDto, @Req() request: AuthenticatedRequest) {
    return this.projectsService.create(dto, request.user.id);
  }

  // DELETE /api/projects/:id => ADMIN-only (enforced in ProjectsService.remove)
  // 204 No Content: nothing to return once the project (and its cascaded rows) is gone.
  @Delete(":id")
  @HttpCode(204)
  delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectsService.remove(id, request.user.id);
  }

  // PATCH /api/projects/:id => ADMIN-only (enforced in ProjectsService.update)
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectsService.update(id, dto, request.user.id);
  }
}
