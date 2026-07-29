// ProjectMembersService: handles all database operations for ProjectMembers
// called by the controller, never called directly by the frontend
// ProjectMember is a join table: each row = one user belonging to one project (many-to-many relation)

import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { AddMemberDto } from "./dto/add-member.dto";

@Injectable()
export class ProjectMembersService {
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // inject PrismaService here via constructor
  // inject ProjectsService here via constructor (for assertMembership below)
  // the constructor is called automatically by NestJS at startup - never called manually
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService
  ) {}

  // NOTE ON ROLES: adding/removing a member changes who's on the team, so unlike most other
  // modules, these two DO need an OWNER/ADMIN check on top of assertMembership - decided with the
  // team (see TR-66) that role checks only matter for Project + ProjectMember management,
  // not everyday content (tasks, discovery blocks, etc.)

  // must also throw (ex: ForbiddenException) if requester.role is neither "OWNER" nor "ADMIN"
  // insert a new row in the ProjectMember table (link a user to a project)
  async addMember(
    projectId: string,
    dto: AddMemberDto,
    requestingUserId: string
  ) {
    // verify requester belongs to the project
    const requester = await this.projectsService.assertMembership(
      projectId,
      requestingUserId
    );
    // verify they're owner or admin
    if (requester.role !== "OWNER" && requester.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the project owner or admin can add members"
      );
    }
    // create a ProjectMember row
    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: "MEMBER",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            campus: true,
          },
        },
      },
    });
  }

  // no role check, any member can see the member list
  // fetch all members belonging to a given project
  async findAll(projectId: string, requestingUserId: string) {
    await this.projectsService.assertMembership(projectId, requestingUserId);
    return this.prisma.projectMember.findMany({
      where: {
        projectId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            campus: true,
          },
        },
      },
    });
  }

  // same requester + role check as addMember (const requester = ...; if (requester.role is neither "OWNER" nor "ADMIN") throw ...)
  // delete the ProjectMember row that links this user to this project
  async removeMember(
    projectId: string,
    userId: string,
    requestingUserId: string
  ) {
    // verify requester belongs to project
    const requester = await this.projectsService.assertMembership(
      projectId,
      requestingUserId
    );
    // only OWNER or ADMIN can remove members
    if (requester.role !== "OWNER" && requester.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the project owner or admin can remove members"
      );
    }
    // verify target exists in project
    const memberToRemove = await this.projectsService.assertMembership(
      projectId,
      userId
    );
    // prevent removing the OWNER - every project has exactly one, enforced in DB (TR-69)
    if (memberToRemove.role === "OWNER") {
      throw new ForbiddenException("Cannot remove the project owner");
    }
    return this.prisma.projectMember.delete({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });
  }
}
