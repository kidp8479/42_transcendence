// ProjectsService: handles all database operations for projects
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectMember } from "@prisma/client";
import { CreateProjectDto } from "./dto/create-project.dto";

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
    // delegates the membership check to assertMembership instead of re-querying it here
    await this.assertMembership(id, userId);

    // assertMembership succeeding guarantees this project exists (foreign key integrity
    // between ProjectMember.projectId and Project.id) - this check is a defensive
    // fallback, not expected to ever trigger in practice
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }

  async create(dto: CreateProjectDto, userId: string) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        deadline: dto.deadline,
        status: dto.status ?? "IN_PROGRESS",
        isArchived: dto.isArchived ?? false,
        members: {
          create: {
            userId,
            // role: "ADMIN", // TODO(pair with teammate): the "role" column
            // exists in schema.prisma but its migration
            // (20260721170656_add_project_member_role) hasn't been applied
            // to this DB yet, so Prisma's generated types don't have it -
            // uncomment once migrations are applied (`prisma migrate dev`).
          },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    const member = await this.assertMembership(id, userId);
    // if (member.role !== "ADMIN") {
    //   throw new ForbiddenException("Only the project admin can delete this project");
    // }

    return this.prisma.project.delete({ where: { id } });
  }

  // NOTE ON ROLES: renaming/deleting the project is a team-affecting, hard-to-undo action -
  // decided with the team (see TR-66) that this needs an ADMIN check, unlike most other
  // modules where any member can act freely (tasks, discovery blocks, etc.)

  // TODO: update(id: string, dto: UpdateProjectDto, userId: string)
  //       => const member = await this.assertMembership(id, userId)
  //       => must also throw (ex: ForbiddenException) if member.role !== "ADMIN"
  //       => update project fields (name, status, deadline, isArchived)

  // TODO: remove(id: string, userId: string)
  //       => same requester + role check as update
  //       => permanently delete a project
}
