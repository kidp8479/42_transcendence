// ProjectMembersController: handles all HTTP requests under /api/projects/:projectId/members
// one method per route - delegates all database work to ProjectMembersService
// ProjectMember is a join table: it links a User to a Project (many-to-many relation)
// a join table has no standalone existence - it only makes sense inside a project context
// that is why routes go through /projects/:projectId/members and not /project-members
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :userId with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/members")
export class ProjectMembersController {
  // TODO: inject ProjectMembersService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/members
  //        => add a user to a project
  //        => expects a request body matching AddMemberDto (userId)
  //        => projectId comes from the URL, not the body
  // GET    /api/projects/:projectId/members
  //        => list all members of a project
  //        => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  // DELETE /api/projects/:projectId/members/:userId
  //        => remove a user from a project
  //        => no request body needed, both ids come from the URL (no DTO)
}
