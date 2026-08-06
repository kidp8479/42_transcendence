// ProjectsService: handles all database operations for projects
// called by the controller, never called directly by the frontend

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  Prisma,
  ProjectMember,
  ProjectStatus,
  EvaluationChecklistItemSection,
} from "@prisma/client";
import { maxProjectsPerUser } from "./projects.constants";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { UpdateProjectDetailsDto } from "./dto/update-project-details.dto";
import { DEFAULT_CALENDAR_CATEGORIES } from "../calendar-categories/default-calendar-categories";
import { DEFAULT_TASK_CATEGORIES } from "../task-categories/default-task-categories";
import { DEFAULT_DISCOVERY_BLOCKS } from "../discovery-blocks/default-discovery-blocks";
import { computeDiscoveryBlockStatus } from "../discovery-blocks/discovery-block-status.util";
import { RealtimeService } from "../realtime/realtime.service";
import { NotificationsService } from "../notifications/notifications.service";
import { isRecordNotFoundError } from "../common/is-record-not-found-error";

// Mirrors the weighted, gated score computed client-side in
// evaluation-checklist.tsx (totalProgress.percent / READINESS_THRESHOLD /
// CATEGORY_WEIGHT) - kept in sync manually since backend and frontend don't
// share a package. Mandatory alone carries the first 100 points; Bonus only
// counts (+25) once Mandatory is fully done, Supplemental only counts (+25)
// once Bonus is too - so the raw score tops out at 150. Capped to 100 here
// because ProjectCard's progress bar (aria-valuemax=100, uncapped width%)
// isn't built to display past 100%, unlike the checklist page's own bar.

// Only used by notifyLifecycleChange()'s fallback branch below - REVIEW has
// no UI path to set it via update() today (ProjectStatusSection only
// toggles COMPLETED/IN_PROGRESS), but a direct API/token call could still
// send it, so this keeps that case worded sensibly instead of undefined.
const projectStatusLabels: Record<ProjectStatus, string> = {
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  COMPLETED: "Completed",
};

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
    private readonly realtimeService: RealtimeService,
    private readonly notificationsService: NotificationsService
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

        // every task needs a category, so seed the default set here too
        for (const category of DEFAULT_TASK_CATEGORIES) {
          await database.taskCategory.create({
            data: {
              projectId: project.id,
              name: category.name,
              color: category.color,
            },
          });
        }

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
  // decided with the team (see TR-66) that this needs a role check, unlike most
  // other modules where any member can act freely (tasks, discovery blocks, etc.).
  // OWNER-only, not OWNER/ADMIN: the frontend only ever offers "Delete project" to
  // the OWNER (ProjectCard.tsx, DangerZoneSection.tsx) - an ADMIN gets "Leave
  // project" instead - so the backend now matches that instead of allowing an
  // ADMIN to delete via a direct API call with no corresponding UI affordance.
  async remove(id: string, userId: string) {
    const member = await this.assertMembership(id, userId);
    if (member.role !== "OWNER") {
      throw new ForbiddenException(
        "Only the project owner can delete this project"
      );
    }

    // Cascades in schema.prisma: every ProjectMember, Task, TaskCategory,
    // CalendarEvent, CalendarCategory, DiscoveryBlock, and EvaluationChecklistItem
    // row for this project is deleted too. Permanent, no soft-delete/undo.
    // No return value: the controller responds 204 No Content (see delete() there).
    // Emit AFTER the delete succeeds, not before - broadcasting first would
    // tell every connected client the project is gone even if the delete
    // then throws (DB error, constraint failure), leaving clients desynced
    // from a project that's still actually there.
    await this.prisma.project.delete({ where: { id } });
    this.realtimeService.emitToProject(id, "project:deleted", { id });
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    const member = await this.assertMembership(id, userId);
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the project owner or admin can update this project"
      );
    }

    // Read before the write so notifyLifecycleChange below can tell what
    // actually transitioned - dto is a partial PATCH, so a field being
    // present doesn't mean its value is actually different.
    const previousProject = await this.prisma.project.findUniqueOrThrow({
      where: { id },
      select: { status: true, isArchived: true },
    });

    // Broadcast project changes to all connected project members so their UI
    // (ex: sidebar project list) can refresh without requiring a page reload.
    // Used for status changes (COMPLETED), archiving, and other project updates.
    //
    // Includes the same fields findById() fetches separately, and reuses
    // `member` from the assertMembership call above instead of calling
    // findById() (which would re-run assertMembership and re-fetch the
    // project from scratch) - one query instead of three for every PATCH.
    const updatedProject = await this.prisma.project.update({
      where: { id },
      data: dto,
      include: {
        evaluationChecklistItems: {
          select: { section: true, isChecked: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });
    const { evaluationChecklistItems, _count, ...rest } = updatedProject;
    const result = {
      ...rest,
      role: member.role,
      progress: computeProjectProgress(evaluationChecklistItems),
      memberCount: _count.members,
    };

    this.realtimeService.emitToProject(id, "project:updated", result);

    await this.notifyLifecycleChange(id, userId, previousProject, result);

    return result;
  }

  // Tells every other project member when the project's lifecycle state
  // changes - finished/unfinished (status <-> COMPLETED) or
  // archived/unarchived (isArchived). Same "notify everyone else, not the
  // actor" pattern as updateDetails() below. Both can change in the same
  // PATCH (e.g. archiving a finished project), so each is checked and
  // notified independently rather than assuming only one fires per call.
  private async notifyLifecycleChange(
    id: string,
    userId: string,
    previous: { status: ProjectStatus; isArchived: boolean },
    updated: { status: ProjectStatus; isArchived: boolean; name: string }
  ): Promise<void> {
    if (
      updated.status === previous.status &&
      updated.isArchived === previous.isArchived
    ) {
      return;
    }

    const [actor, otherMembers] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { username: true },
      }),
      this.prisma.projectMember.findMany({
        where: { projectId: id, userId: { not: userId } },
        select: { userId: true },
      }),
    ]);
    if (otherMembers.length === 0) {
      return;
    }

    const messages: string[] = [];
    if (updated.status !== previous.status) {
      messages.push(
        updated.status === "COMPLETED"
          ? `${actor.username} marked "${updated.name}" as finished`
          : previous.status === "COMPLETED"
            ? `${actor.username} marked "${updated.name}" as unfinished`
            : `${actor.username} changed "${updated.name}"'s status to ${projectStatusLabels[updated.status]}`
      );
    }
    if (updated.isArchived !== previous.isArchived) {
      messages.push(
        updated.isArchived
          ? `${actor.username} archived "${updated.name}"`
          : `${actor.username} unarchived "${updated.name}"`
      );
    }

    await Promise.all(
      otherMembers.flatMap((otherMember) =>
        messages.map((message) =>
          this.notificationsService.create(
            otherMember.userId,
            message,
            `/${id}/project-settings`
          )
        )
      )
    );
  }

  // Same OWNER/ADMIN gate as update() above - kept as its own method anyway
  // (not merged into update()/UpdateProjectDto) so the optimistic-
  // concurrency check below stays scoped to this endpoint only, instead of
  // forcing every existing update() caller (ex: ProjectStatusSection's
  // finish/archive toggles) to start sending updatedAt too.
  async updateDetails(
    id: string,
    dto: UpdateProjectDetailsDto,
    userId: string
  ) {
    const member = await this.assertMembership(id, userId);
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the project owner or admin can update this project"
      );
    }

    // Read before the write so the notification below can tell whether
    // anything actually changed - dto always carries name (required) and
    // often an unchanged description, so a no-op Save shouldn't spam every
    // other member. Same reasoning as notifyLifecycleChange()'s before-read.
    const previousProject = await this.prisma.project.findUniqueOrThrow({
      where: { id },
      select: { name: true, description: true },
    });

    let updatedProject;
    try {
      updatedProject = await this.prisma.project.update({
        // Matching on updatedAt too, not just id, is the optimistic-
        // concurrency check: dto.updatedAt is the version this edit was
        // based on. If someone else's edit already landed, the row's real
        // updatedAt has moved on and no row matches this where clause -
        // Prisma throws instead of writing, so this save can never
        // silently overwrite a concurrent edit.
        where: { id, updatedAt: new Date(dto.updatedAt) },
        data: {
          name: dto.name,
          description: dto.description,
        },
        include: {
          evaluationChecklistItems: {
            select: { section: true, isChecked: true },
          },
          _count: {
            select: { members: true },
          },
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new ConflictException(
          "This project was updated by someone else. Reload and try again."
        );
      }
      throw error;
    }

    const { evaluationChecklistItems, _count, ...rest } = updatedProject;
    const result = {
      ...rest,
      role: member.role,
      progress: computeProjectProgress(evaluationChecklistItems),
      memberCount: _count.members,
    };

    // Tells every other project member their teammate changed the
    // project's details - same "notify everyone else, not the actor"
    // pattern already used for member removal/role changes in
    // project-members.service.ts. Skipped entirely if nothing actually
    // changed (e.g. Save clicked with no edits).
    if (
      result.name !== previousProject.name ||
      result.description !== previousProject.description
    ) {
      const [actor, otherMembers] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { username: true },
        }),
        this.prisma.projectMember.findMany({
          where: { projectId: id, userId: { not: userId } },
          select: { userId: true },
        }),
      ]);
      await Promise.all(
        otherMembers.map((otherMember) =>
          this.notificationsService.create(
            otherMember.userId,
            `${actor.username} updated "${result.name}"'s details`,
            `/${id}/project-settings`
          )
        )
      );
    }

    this.realtimeService.emitToProject(id, "project:updated", result);

    return result;
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
