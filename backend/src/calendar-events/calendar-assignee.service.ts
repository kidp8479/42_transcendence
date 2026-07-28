// Manages the CalendarAssignee join table (which users are assigned to a
// calendar event). No controller of its own - only used via the
// assigneeIds array on CreateCalendarEventDto/UpdateCalendarEventDto.
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CalendarAssigneeService {
  constructor(private readonly prisma: PrismaService) {}

  // wipes the event's current assignees and inserts the new list, in one
  // transaction so a crash mid-way can't leave it half-updated
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
