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
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: addMember(projectId: string, dto: AddMemberDto, requestingUserId: string)
  //       => must throw (ex: NotFoundException) if requestingUserId is not a ProjectMember of projectId
  //       => insert a new row in the ProjectMember table (link a user to a project)
  // TODO: findAll(projectId: string, requestingUserId: string)
  //       => must throw if requestingUserId is not a ProjectMember of projectId
  //       => fetch all members belonging to a given project
  // TODO: removeMember(projectId: string, userId: string, requestingUserId: string)
  //       => must throw if requestingUserId is not a ProjectMember of projectId
  //       => delete the ProjectMember row that links this user to this project
}
