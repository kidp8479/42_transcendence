import { Module } from "@nestjs/common";
import { CalendarEventsService } from "./calendar-events.service";
import { CalendarEventsController } from "./calendar-events.controller";
import { CalendarAssigneeService } from "./calendar-assignee.service";

@Module({
  controllers: [CalendarEventsController], // handles HTTP requests
  // CalendarAssigneeService has no controller/module of its own - it's a plain internal
  // helper injected into CalendarEventsService to manage the CalendarAssignee join-table
  // rows (assigneeIds array) when creating or updating a calendar event.
  providers: [CalendarEventsService, CalendarAssigneeService], // handles database operations
  exports: [CalendarEventsService], // expose CalendarEventsService to other modules that may need it
})
export class CalendarEventsModule {}
