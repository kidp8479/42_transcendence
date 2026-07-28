// ProjectMembersService: handles all database operations for ProjectMembers
// called by the controller, never called directly by the frontend
// ProjectMember is a join table: each row = one user belonging to one project (many-to-many relation)

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService
  ) {}


  // TODO: addMember(projectId: string, dto: AddMemberDto, requestingUserId: string)
  //       => const requester = await projectsService.assertMembership(projectId, requestingUserId)
  //       => must also throw (ex: ForbiddenException) if requester.role is neither "OWNER" nor "ADMIN"
  //       => insert a new row in the ProjectMember table (link a user to a project)

  // only findAll is implemented for now, needed by the Calendar tab's assignee
  // picker (TR-51) - no role check, any member can see the member list.
  // addMember/removeMember stay TODO, left for the Project Settings ticket.
  async findAll(projectId: string, requestingUserId: string) {
    await this.projectsService.assertMembership(projectId, requestingUserId);
    return this.prisma.projectMember.findMany({
      where: { projectId: projectId },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });
  }

  // TODO: removeMember(projectId: string, userId: string, requestingUserId: string)
  //       => same requester + role check as addMember (const requester = ...; if (requester.role is neither "OWNER" nor "ADMIN") throw ...)
  //       => delete the ProjectMember row that links this user to this project
}
