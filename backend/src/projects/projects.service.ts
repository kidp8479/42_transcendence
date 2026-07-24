// ProjectsService: handles all database operations for projects
// called by the controller, never called directly by the frontend

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectMember } from "@prisma/client";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

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
    const projects = await this.prisma.project.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        evaluationChecklistItems: {
          select: { isChecked: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return projects.map(
      ({ members, evaluationChecklistItems, _count, ...project }) => {
        const total = evaluationChecklistItems.length;
        const validated = evaluationChecklistItems.filter(
          (i) => i.isChecked
        ).length;
        return {
          ...project,
          role: members[0].role,
          progress: total === 0 ? 0 : Math.round((validated / total) * 100),
          memberCount: _count.members,
        };
      }
    );
  }

  async findById(id: string, userId: string) {
    // delegates the membership check to assertMembership instead of re-querying it here
    const member = await this.assertMembership(id, userId);

    // assertMembership succeeding guarantees this project exists (foreign key integrity
    // between ProjectMember.projectId and Project.id) - this check is a defensive
    // fallback, not expected to ever trigger in practice
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        evaluationChecklistItems: {
          select: { isChecked: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const { evaluationChecklistItems, _count, ...rest } = project;
    const total = evaluationChecklistItems.length;
    const validated = evaluationChecklistItems.filter(
      (i: { isChecked: boolean }) => i.isChecked
    ).length;
    return {
      ...rest,
      role: member.role,
      progress: total === 0 ? 0 : Math.round((validated / total) * 100),
      memberCount: _count.members,
    };
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
            role: "ADMIN",
          },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    const member = await this.assertMembership(id, userId);
    if (member.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the project admin can delete this project"
      );
    }

    return this.prisma.project.delete({ where: { id } });
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    const member = await this.assertMembership(id, userId);
    if (member.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the project admin can update this project"
      );
    }

    return this.prisma.project.update({ where: { id }, data: dto });
  }
}
