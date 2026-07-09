// CalendarAssigneeService: manages the CalendarAssignee join table (which users are assigned
// to a calendar event)
// no controller, no module of its own - injected directly into CalendarEventsService, since
// assignees are only ever set through the assigneeIds array on CreateCalendarEventDto/
// UpdateCalendarEventDto, never their own standalone endpoint (unlike ProjectMember, which
// needs one - see project-members module)
import { Injectable } from "@nestjs/common";

@Injectable()
export class CalendarAssigneeService {
  // TODO: inject PrismaService here via constructor
  // TODO: replaceAssignees(calId: string, userIds: string[])
  //       => called by CalendarEventsService on create/update: deletes existing
  //          CalendarAssignee rows for this event, then inserts one row per userId in the new list
}
