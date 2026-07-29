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

import {
  Controller,
  Get,
  Param,
  Req,
  ParseUUIDPipe,
  Post,
  Body,
  Delete,
} from "@nestjs/common";

import { ProjectMembersService } from "./project-members.service";
import { AuthenticatedRequest } from "../auth/authenticated-request";
import { AddMemberDto } from "./dto/add-member.dto";

@Controller("projects/:projectId/members")
export class ProjectMembersController {
  // inject ProjectMembersService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  // ENDPOINTS:
  // POST   /api/projects/:projectId/members
  //	=> add a user to a project
  //    => expects a request body matching AddMemberDto (userId)
  //    => projectId comes from the URL, not the body
  @Post()
  addMember(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: AddMemberDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectMembersService.addMember(
      projectId,
      dto,
      request.user.id
    );
  }

  // GET    /api/projects/:projectId/members
  //    => list all members of a project
  //    => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectMembersService.findAll(projectId, request.user.id);
  }

  // DELETE /api/projects/:projectId/members/:userId
  //    => remove a user from a project
  //    => no request body needed, both ids come from the URL (no DTO)
  @Delete(":userId")
  removeMember(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectMembersService.removeMember(
      projectId,
      userId,
      request.user.id
    );
  }
}
