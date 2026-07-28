// Database operations for CalendarEvents, called by the controller.

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

// shared include so every read path returns the same shape: the category
// (for the label/color) and each assignee's user info (for avatars)
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

// Prisma returns the CalendarAssignee join rows, not the users directly -
// flatten each row down to its nested user before sending the response.
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
        projectId: projectId, // from the url, not the dto
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

  // also used by update/remove as an access guard: confirms membership and
  // that this event belongs to this project, 404s otherwise
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
    await this.findById(id, projectId, userId); // access guard
    if (dto.categoryId) {
      await this.assertCategoryBelongsToProject(projectId, dto.categoryId);
    }

    // assigneeIds isn't a column on CalendarEvent, handle it separately below
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
    await this.findById(id, projectId, userId); // access guard
    // same include as every other read path - without it the response is
    // missing category/assignees and the frontend rejects it as invalid
    const event = await this.prisma.calendarEvent.delete({
      where: { id: id },
      include: calendarEventInclude,
    });
    return mapCalendarEvent(event);
  }

  // categoryId comes from the body, so it could point at a category from a
  // different project - check it belongs here before using it
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

  // same idea for assignees: the DTO only checks each id is a UUID, not that
  // it belongs to a real member of this project
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
