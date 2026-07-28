// CalendarEventsService: handles all database operations for CalendarEvents
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { CalendarAssigneeService } from "./calendar-assignee.service";
import { CreateCalendarEventDto } from "./dto/create-calendar-event.dto";
import { UpdateCalendarEventDto } from "./dto/update-calendar-event.dto";

// shared include so every read path (findAll/findById, and the object returned
// by create/update) sends back the same shape: the category (for the Label
// dropdown/pill color) and each assignee's user info (for avatars) - never
// raw foreign keys alone, the frontend never re-fetches these separately.
const calendarEventInclude = {
  category: true,
  assignees: {
    include: {
      user: {
        select: { id: true, username: true, avatarUrl: true },
      },
    },
  },
};

type CalendarEventWithRelations = Prisma.CalendarEventGetPayload<{
  include: typeof calendarEventInclude;
}>;

// Prisma's assignees include returns the CalendarAssignee join row itself
// (id = the join row's own id, userId/calId, nested user object) - the
// frontend only cares about "which users are assigned", so this flattens
// each row down to just its user info before the response leaves the API.
function mapCalendarEvent(event: CalendarEventWithRelations) {
  return {
    ...event,
    assignees: event.assignees.map((assignee) => assignee.user),
  };
}

@Injectable()
export class CalendarEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarAssigneeService: CalendarAssigneeService,
    private readonly projectsService: ProjectsService
  ) {}

  async create(projectId: string, dto: CreateCalendarEventDto, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    await this.assertCategoryBelongsToProject(projectId, dto.categoryId);
    if (dto.assigneeIds) {
      await this.assertAssigneesAreProjectMembers(projectId, dto.assigneeIds);
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        categoryId: dto.categoryId,
        startAt: dto.startAt,
        endAt: dto.endAt,
        description: dto.description,
        notes: dto.notes,
        projectId: projectId, // does not come from the dto but from the url
      },
    });

    if (dto.assigneeIds) {
      await this.calendarAssigneeService.replaceAssignees(
        event.id,
        dto.assigneeIds
      );
    }

    return this.findById(event.id, projectId, userId);
  }

  async findAll(projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    const events = await this.prisma.calendarEvent.findMany({
      where: { projectId: projectId },
      include: calendarEventInclude,
      orderBy: { startAt: "asc" },
    });
    return events.map(mapCalendarEvent);
  }

  // also reused by update/remove as their access guard: it already checks both
  // "is userId a member of projectId" and "does this id belong to projectId",
  // and throws the right NotFoundException in each case
  async findById(id: string, projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: id, projectId: projectId },
      include: calendarEventInclude,
    });
    if (!event) {
      throw new NotFoundException("Calendar event not found");
    }
    return mapCalendarEvent(event);
  }

  async update(
    id: string,
    dto: UpdateCalendarEventDto,
    projectId: string,
    userId: string
  ) {
    await this.findById(id, projectId, userId); // access guard, see findById's own comment
    if (dto.categoryId) {
      await this.assertCategoryBelongsToProject(projectId, dto.categoryId);
    }

    // destructure assigneeIds out: it is not a column on CalendarEvent, it is
    // handled separately below via CalendarAssigneeService
    const assigneeIds = dto.assigneeIds;
    if (assigneeIds) {
      await this.assertAssigneesAreProjectMembers(projectId, assigneeIds);
    }
    const eventFields = {
      title: dto.title,
      categoryId: dto.categoryId,
      startAt: dto.startAt,
      endAt: dto.endAt,
      description: dto.description,
      notes: dto.notes,
    };

    await this.prisma.calendarEvent.update({
      where: { id: id },
      data: eventFields,
    });

    if (assigneeIds) {
      await this.calendarAssigneeService.replaceAssignees(id, assigneeIds);
    }

    return this.findById(id, projectId, userId);
  }

  async remove(id: string, projectId: string, userId: string) {
    await this.findById(id, projectId, userId); // access guard, see findById's own comment
    // include + mapCalendarEvent: same full shape as every other read path -
    // without it, calendarEvent.delete() returns raw scalar fields only (no
    // category/assignees), and the frontend's response parser rejects it as
    // invalid even though the delete itself succeeded.
    const event = await this.prisma.calendarEvent.delete({
      where: { id: id },
      include: calendarEventInclude,
    });
    return mapCalendarEvent(event);
  }

  // categoryId is a body field, not a URL param, so nothing else stops a
  // member of projectId from passing a categoryId that belongs to a
  // different project - without this check the event would still save (the
  // FK just needs any valid CalendarCategory row) and every read path would
  // then leak that other project's category name/color to this project's
  // members.
  private async assertCategoryBelongsToProject(
    projectId: string,
    categoryId: string
  ): Promise<void> {
    const category = await this.prisma.calendarCategory.findFirst({
      where: { id: categoryId, projectId: projectId },
    });
    if (!category) {
      throw new BadRequestException(
        "categoryId does not belong to this project"
      );
    }
  }

  // same reasoning as assertCategoryBelongsToProject: assigneeIds are plain
  // user ids, nothing stops a caller from assigning a user who was never a
  // member of this project (or never existed) - CreateCalendarEventDto only
  // validates each id is a UUID, not that it maps to a real member.
  private async assertAssigneesAreProjectMembers(
    projectId: string,
    userIds: string[]
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    const memberCount = await this.prisma.projectMember.count({
      where: { projectId: projectId, userId: { in: userIds } },
    });
    if (memberCount !== userIds.length) {
      throw new BadRequestException(
        "assigneeIds must all be members of this project"
      );
    }
  }
}
