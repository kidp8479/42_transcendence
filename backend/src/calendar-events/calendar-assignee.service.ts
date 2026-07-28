// CalendarAssigneeService: manages the CalendarAssignee join table (which users are assigned
// to a calendar event)
// no controller, no module of its own - injected directly into CalendarEventsService, since
// assignees are only ever set through the assigneeIds array on CreateCalendarEventDto/
// UpdateCalendarEventDto, never their own standalone endpoint (unlike ProjectMember, which
// needs one - see project-members module)
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CalendarAssigneeService {
  constructor(private readonly prisma: PrismaService) {}

  // called by CalendarEventsService on create/update: deletes existing CalendarAssignee
  // rows for this event, then inserts one row per userId in the new list. Wrapped in a
  // transaction so a crash mid-way never leaves the event with only some of its
  // assignees replaced.
  async replaceAssignees(calId: string, userIds: string[]): Promise<void> {
    await this.prisma.transaction(async (transactionPrisma) => {
      await transactionPrisma.calendarAssignee.deleteMany({
        where: { calId: calId },
      });
      if (userIds.length > 0) {
        await transactionPrisma.calendarAssignee.createMany({
          data: userIds.map((userId) => ({ userId: userId, calId: calId })),
        });
      }
    });
  }
}
