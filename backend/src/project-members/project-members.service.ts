// ProjectMember is a join table: each row links one user to one project.

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService
  ) {}


  // TODO: addMember - assertMembership, require requester.role is "OWNER" or "ADMIN",
  // then insert a new ProjectMember row

  // only findAll is implemented for now, needed by the Calendar tab's
  // assignee picker - any member can see the member list, no role check.
  // addMember/removeMember are for the Project Settings ticket.
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

  // TODO: removeMember - same requester + OWNER/ADMIN check as addMember, then
  // delete the matching ProjectMember row
}
