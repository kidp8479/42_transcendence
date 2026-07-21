// ProjectsService: handles all database operations for projects
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectMember } from "@prisma/client";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // shared access guard, meant to be called by any module that needs to verify
  // "is userId allowed to access projectId" (discovery-blocks, tasks, calendar-events, etc.)
  // instead of each module writing its own membership query.
  // Returns the ProjectMember row itself (not void) so callers who need the role later
  // (ex: only ADMIN can delete/update) can read `.role` off it without this method's
  // signature ever having to change - role-based checks are not implemented yet.
  // Always throws NotFoundException (never Forbidden) whether the project doesn't exist
  // or userId just isn't a member of it - deliberately not revealing which, to avoid
  // leaking project existence to users who don't have access (IDOR).
  async assertMembership(
    projectId: string,
    userId: string
  ): Promise<ProjectMember> {
    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, userId },
    });
    if (!member) {
      throw new NotFoundException("Project not found");
    }
    return member;
  }

  // fetch all projects where userId is a ProjectMember
  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
    });
  }

  async findById(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        members: { some: { userId } },
      },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }

  // TODO: create(dto: CreateProjectDto, userId: string)
  //       => insert a new project in the database
  //       => default status: IN_PROGRESS (set by Prisma schema, not the DTO)
  //       => optional fields: description, deadline, isArchived
  //       => must also create a ProjectMember row linking userId to the new project

  // TODO: update(id: string, dto: UpdateProjectDto, userId: string)
  //       => update project fields (name, status, deadline, isArchived)
  //       => same membership check as findById

  // TODO: remove(id: string, userId: string)
  //       => permanently delete a project
  //       => same membership check as findById
}
