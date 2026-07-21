// ProjectMembersService: handles all database operations for ProjectMembers
// called by the controller, never called directly by the frontend
// ProjectMember is a join table: each row = one user belonging to one project (many-to-many relation)

import { Injectable } from "@nestjs/common";

@Injectable()
export class ProjectMembersService {
  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // TODO: inject ProjectsService here via constructor (for assertMembership below)
  // the constructor is called automatically by NestJS at startup - never called manually
  //
  // NOTE ON ROLES: adding/removing a member changes who's on the team, so unlike most other
  // modules, these two DO need an ADMIN check on top of assertMembership - decided with the
  // team (see TR-66) that role checks only matter for Project + ProjectMember management,
  // not everyday content (tasks, discovery blocks, etc.)
  //
  // TODO: addMember(projectId: string, dto: AddMemberDto, requestingUserId: string)
  //       => const requester = await projectsService.assertMembership(projectId, requestingUserId)
  //       => must also throw (ex: ForbiddenException) if requester.role !== "ADMIN"
  //       => insert a new row in the ProjectMember table (link a user to a project)
  // TODO: findAll(projectId: string, requestingUserId: string)
  //       => call projectsService.assertMembership(projectId, requestingUserId) - no role check,
  //          any member can see the member list
  //       => fetch all members belonging to a given project
  // TODO: removeMember(projectId: string, userId: string, requestingUserId: string)
  //       => same requester + role check as addMember (const requester = ...; if (requester.role !== "ADMIN") throw ...)
  //       => delete the ProjectMember row that links this user to this project
}
