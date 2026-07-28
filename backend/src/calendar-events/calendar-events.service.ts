// CalendarEventsService: handles all database operations for CalendarEvents
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
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

@Injectable()
export class CalendarEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarAssigneeService: CalendarAssigneeService,
    private readonly projectsService: ProjectsService
  ) {}

  async create(projectId: string, dto: CreateCalendarEventDto, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);

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
    return this.prisma.calendarEvent.findMany({
      where: { projectId: projectId },
      include: calendarEventInclude,
      orderBy: { startAt: "asc" },
    });
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
    return event;
  }

  async update(
    id: string,
    dto: UpdateCalendarEventDto,
    projectId: string,
    userId: string
  ) {
    await this.findById(id, projectId, userId); // access guard, see findById's own comment

    // destructure assigneeIds out: it is not a column on CalendarEvent, it is
    // handled separately below via CalendarAssigneeService
    const assigneeIds = dto.assigneeIds;
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
    return this.prisma.calendarEvent.delete({ where: { id: id } });
  }
}
