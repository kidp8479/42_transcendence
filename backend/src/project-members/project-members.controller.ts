// HTTP routes for a project's members. Routes go through
// /projects/:projectId/members, not /project-members, since a join table
// only makes sense inside a project context. Every route checks membership
// in the service before touching data, so switching :projectId in the URL
// can't leak or edit another project's members (IDOR).

import { Controller, Get, Param, ParseUUIDPipe, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { ProjectMembersService } from "./project-members.service";

@Controller("projects/:projectId/members")
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  // TODO: POST - add a user to a project (body: AddMemberDto with userId)

  // list this project's members - only route implemented for now, see
  // ProjectMembersService
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectMembersService.findAll(projectId, request.user.id);
  }

  // TODO: DELETE /:userId - remove a user from a project (no body needed)
}
