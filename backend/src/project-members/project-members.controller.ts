// ProjectMembersController: handles all HTTP requests under /api/projects/:projectId/members
// one method per route - delegates all database work to ProjectMembersService
// ProjectMember is a join table: it links a User to a Project (many-to-many relation)
// a join table has no standalone existence - it only makes sense inside a project context
// that is why routes go through /projects/:projectId/members and not /project-members
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :userId with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :projectId alone does not prove access - every route must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could list or modify another project's
// members just by changing the projectId in the URL (IDOR).

import { Controller, Get, Param, ParseUUIDPipe, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { ProjectMembersService } from "./project-members.service";

@Controller("projects/:projectId/members")
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  // TODO: POST /api/projects/:projectId/members
  //       => add a user to a project
  //       => expects a request body matching AddMemberDto (userId)
  //       => projectId comes from the URL, not the body

  // GET /api/projects/:projectId/members => list all members of a project
  // only route implemented for now - see ProjectMembersService for why
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectMembersService.findAll(projectId, request.user.id);
  }

  // TODO: DELETE /api/projects/:projectId/members/:userId
  //       => remove a user from a project
  //       => no request body needed, both ids come from the URL (no DTO)
}
