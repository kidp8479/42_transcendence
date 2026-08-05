// Database operations for CalendarEvents, called by the controller.

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CalendarAssigneeService } from "./calendar-assignee.service";
import { isRecordNotFoundError } from "../common/is-record-not-found-error";
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
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService
  ) {}

  // called from create/update below, right after replaceAssignees - notifies
  // only users newly added as an assignee (never the acting user, who
  // already knows), not everyone still assigned from before.
  // messageFor: create's "New event..." reads wrong for update (the event
  // isn't new, just newly assigning someone to it) - each call site builds
  // its own message text, this only decides who gets notified.
  private async notifyNewAssignees(
    projectId: string,
    previousAssigneeIds: string[],
    newAssigneeIds: string[],
    actingUserId: string,
    messageFor: (projectName: string) => string
  ): Promise<void> {
    const addedUserIds = newAssigneeIds.filter(
      (userId) =>
        !previousAssigneeIds.includes(userId) && userId !== actingUserId
    );
    if (addedUserIds.length === 0) {
      return;
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true },
    });
    const message = messageFor(project.name);

    // each assignee's insert + socket emit is independent - run them
    // concurrently instead of awaiting one at a time, so this request
    // isn't delayed by N sequential DB round-trips on an event with N
    // new assignees, same reasoning as
    // EvaluationChecklistItemsService.notifySectionIfJustCompleted
    await Promise.all(
      addedUserIds.map((userId) =>
        this.notificationsService.create(
          userId,
          message,
          `/${projectId}/calendar`
        )
      )
    );
  }

  async create(projectId: string, dto: CreateCalendarEventDto, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    this.assertValidDateRange(dto.startAt, dto.endAt);
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
      // no previous assignees on a brand new event - every id in
      // dto.assigneeIds is "new"
      await this.notifyNewAssignees(
        projectId,
        [],
        dto.assigneeIds,
        userId,
        (projectName) =>
          `New event "${event.title}" assigned to you on "${projectName}"`
      );
    }

    return this.findById(event.id, projectId, userId);
  }

  async findAll(projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    return this.findAllForProject(projectId);
  }

  async findAllForProject(projectId: string, limit?: number) {
    const events = await this.prisma.calendarEvent.findMany({
      where: { projectId: projectId },
      include: calendarEventInclude,
      orderBy: { startAt: "asc" },
      ...(limit === undefined ? {} : { take: limit }),
    });
    return events.map(mapCalendarEvent);
  }

  // also used by update/remove as an access guard: confirms membership and
  // that this event belongs to this project, 404s otherwise
  async findById(id: string, projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    return this.findByIdForProject(id, projectId);
  }

  async findByIdForProject(id: string, projectId: string) {
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
    const existingEvent = await this.findById(id, projectId, userId); // access guard
    // a PATCH can send only one of startAt/endAt - validate the pair as it
    // will actually end up in the database, not just the field(s) sent.
    // Pure/synchronous, so it runs before the remaining DB round-trips below.
    this.assertValidDateRange(
      dto.startAt ?? existingEvent.startAt.toISOString(),
      dto.endAt ?? existingEvent.endAt.toISOString()
    );
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

    try {
      await this.prisma.calendarEvent.update({
        where: { id: id },
        data: eventFields,
      });
    } catch (error) {
      // someone else deleted this event in the race window between the
      // guard above and this update - a clean 404 instead of Prisma's raw
      // "record to update not found" text leaking to the client
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException("Calendar event not found");
      }
      throw error;
    }

    if (assigneeIds) {
      // existingEvent was fetched above, before replaceAssignees wipes the
      // old rows - its own assignees list is the "previous" set to diff against
      await this.calendarAssigneeService.replaceAssignees(id, assigneeIds);
      const eventTitle = dto.title ?? existingEvent.title;
      await this.notifyNewAssignees(
        projectId,
        existingEvent.assignees.map((assignee) => assignee.id),
        assigneeIds,
        userId,
        (projectName) => `You were added to "${eventTitle}" on "${projectName}"`
      );
    }

    return this.findById(id, projectId, userId);
  }

  async remove(id: string, projectId: string, userId: string) {
    const existingEvent = await this.findById(id, projectId, userId); // access guard

    // two members deleting the same event within the same race window both
    // want it gone - same reasoning as the other services in this PR
    try {
      // same include as every other read path - without it the response is
      // missing category/assignees and the frontend rejects it as invalid
      const event = await this.prisma.calendarEvent.delete({
        where: { id: id },
        include: calendarEventInclude,
      });
      return mapCalendarEvent(event);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return existingEvent;
      }
      throw error;
    }
  }

  // the frontend already blocks this in the form, but nothing stops a direct
  // API call from skipping it - enforce it here too
  private assertValidDateRange(startAt: string, endAt: string): void {
    if (new Date(endAt) < new Date(startAt)) {
      throw new BadRequestException("endAt must not be before startAt");
    }
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
