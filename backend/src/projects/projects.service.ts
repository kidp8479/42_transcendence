// ProjectsService: handles all database operations for projects
// called by the controller, never called directly by the frontend

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  Prisma,
  ProjectMember,
  EvaluationChecklistItemSection,
} from "@prisma/client";
import { maxProjectsPerUser } from "./projects.constants";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { DEFAULT_CALENDAR_CATEGORIES } from "../calendar-categories/default-calendar-categories";
import { DEFAULT_TASK_CATEGORIES } from "../task-categories/default-task-categories";
<<<<<<< HEAD
import { DEFAULT_DISCOVERY_BLOCKS } from "../discovery-blocks/default-discovery-blocks";
import { computeDiscoveryBlockStatus } from "../discovery-blocks/discovery-block-status.util";
import { RealtimeService } from "../realtime/realtime.service";
=======
>>>>>>> 1e14176 (feat(TR-49): add backend of kanban and fix bugs in the frontend)

// Mirrors the weighted, gated score computed client-side in
// evaluation-checklist.tsx (totalProgress.percent / READINESS_THRESHOLD /
// CATEGORY_WEIGHT) - kept in sync manually since backend and frontend don't
// share a package. Mandatory alone carries the first 100 points; Bonus only
// counts (+25) once Mandatory is fully done, Supplemental only counts (+25)
// once Bonus is too - so the raw score tops out at 150. Capped to 100 here
// because ProjectCard's progress bar (aria-valuemax=100, uncapped width%)
// isn't built to display past 100%, unlike the checklist page's own bar.
function computeProjectProgress(
  items: { section: EvaluationChecklistItemSection; isChecked: boolean }[]
): number {
  function sectionPercent(section: EvaluationChecklistItemSection): number {
    const sectionItems = items.filter((item) => item.section === section);
    if (sectionItems.length === 0) {
      return 0;
    }
    const checked = sectionItems.filter((item) => item.isChecked).length;
    return Math.round((checked / sectionItems.length) * 100);
  }

  const mandatoryPercent = sectionPercent("MANDATORY");
  const bonusPercent = sectionPercent("BONUS");
  const supplementalPercent = sectionPercent("SUPPLEMENTAL");
  const mandatoryComplete = mandatoryPercent >= 100;
  const bonusComplete = bonusPercent >= 100;

  let overallPercent = mandatoryPercent;
  if (mandatoryComplete) {
    overallPercent += (bonusPercent / 100) * 25;
    if (bonusComplete) {
      overallPercent += (supplementalPercent / 100) * 25;
    }
  }
  return Math.min(Math.round(overallPercent), 100);
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService
  ) {}

  // shared access guard, meant to be called by any module that needs to verify
  // "is userId allowed to access projectId" (discovery-blocks, tasks, calendar-events, etc.)
  // instead of each module writing its own membership query.
  // Returns the ProjectMember row itself (not void) so callers who need the role later
  // (ex: only OWNER/ADMIN can delete/update, see remove/update below) can read `.role` off
  // it without this method's signature ever having to change.
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
          select: { section: true, isChecked: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return projects.map(
      ({ members, evaluationChecklistItems, _count, ...project }) => ({
        ...project,
        role: members[0].role,
        progress: computeProjectProgress(evaluationChecklistItems),
        memberCount: _count.members,
      })
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
          select: { section: true, isChecked: true },
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
    return {
      ...rest,
      role: member.role,
      progress: computeProjectProgress(evaluationChecklistItems),
      memberCount: _count.members,
    };
  }

  async create(dto: CreateProjectDto, userId: string) {
    const project = await this.prisma.transaction(
      async (database) => {
        const membershipCount = await database.projectMember.count({
          where: { userId },
        });
        if (membershipCount >= maxProjectsPerUser) {
          throw new BadRequestException(
            `You've reached the maximum of ${maxProjectsPerUser} projects.`
          );
        }

        const project = await database.project.create({
          data: {
            name: dto.name,
            description: dto.description,
            deadline: dto.deadline,
            status: dto.status ?? "IN_PROGRESS",
            isArchived: dto.isArchived ?? false,
            members: {
              create: {
                userId,
                role: "OWNER",
              },
            },
          },
        });

        // every event needs a label, so seed the default set here too
        for (const category of DEFAULT_CALENDAR_CATEGORIES) {
          await database.calendarCategory.create({
            data: {
              projectId: project.id,
              name: category.name,
              color: category.color,
            },
          });
        }

<<<<<<< HEAD
        // every task needs a category, so seed the default set here too
=======
        // same for tasks: CreateTaskDto requires a categoryId, so without this
        // a brand-new project could not have a single task created in it.
>>>>>>> 1e14176 (feat(TR-49): add backend of kanban and fix bugs in the frontend)
        for (const category of DEFAULT_TASK_CATEGORIES) {
          await database.taskCategory.create({
            data: {
              projectId: project.id,
              name: category.name,
              color: category.color,
            },
          });
        }

<<<<<<< HEAD
        // unlike task/calendar categories, discovery blocks are just a
        // starting point - the user is free to delete or edit them afterwards
        for (const block of DEFAULT_DISCOVERY_BLOCKS) {
          const seedItems = block.items.map((label, index) => {
            return { label: label, order: index, isChecked: false };
          });
          await database.discoveryBlock.create({
            data: {
              projectId: project.id,
              title: block.title,
              icon: block.icon,
              color: block.color,
              status: computeDiscoveryBlockStatus(seedItems),
              discoveryBlockItems: {
                create: seedItems,
              },
            },
          });
        }

=======
>>>>>>> 1e14176 (feat(TR-49): add backend of kanban and fix bugs in the frontend)
        return this.findProjectForUser(database, project.id, userId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    // outside the transaction on purpose - an in-memory room join isn't
    // part of the DB's atomicity guarantee, and doesn't need to roll back
    // with it. Without this, a creator with an already-open socket would
    // miss every realtime broadcast for their own new project (their
    // socket only joined rooms for projects that existed at connect time)
    // until their next reconnect.
    this.realtimeService.joinProjectRoom(userId, project.id);
    return project;
  }

  // NOTE ON ROLES: deleting the project is a team-affecting, hard-to-undo action -
  // decided with the team (see TR-66) that this needs an OWNER/ADMIN check, unlike most
  // other modules where any member can act freely (tasks, discovery blocks, etc.).
  async remove(id: string, userId: string) {
    const member = await this.assertMembership(id, userId);
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the project owner or admin can delete this project"
      );
    }

    // Cascades in schema.prisma: every ProjectMember, Task, TaskCategory,
    // CalendarEvent, CalendarCategory, DiscoveryBlock, and EvaluationChecklistItem
    // row for this project is deleted too. Permanent, no soft-delete/undo.
    // No return value: the controller responds 204 No Content (see delete() there).
    await this.prisma.project.delete({ where: { id } });
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    const member = await this.assertMembership(id, userId);
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the project owner or admin can update this project"
      );
    }

    await this.prisma.project.update({ where: { id }, data: dto });
    return this.findById(id, userId);
  }

  private async findProjectForUser(
    database: Pick<Prisma.TransactionClient, "project">,
    id: string,
    userId: string
  ) {
    const project = await database.project.findFirst({
      where: { id, members: { some: { userId } } },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        evaluationChecklistItems: {
          select: { section: true, isChecked: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const { members, evaluationChecklistItems, _count, ...rest } = project;
    return {
      ...rest,
      role: members[0].role,
      progress: computeProjectProgress(evaluationChecklistItems),
      memberCount: _count.members,
    };
  }
}
