// CalendarEventsModule: registers the controller and service for the CalendarEvents feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { CalendarEventsService } from "./calendar-events.service";
import { CalendarEventsController } from "./calendar-events.controller";
import { CalendarAssigneeService } from "./calendar-assignee.service";

@Module({
  imports: [ProjectsModule], // needed to inject ProjectsService (assertMembership) into CalendarEventsService
  controllers: [CalendarEventsController], // handles HTTP requests
  // CalendarAssigneeService has no controller/module of its own - it's a plain internal
  // helper injected into CalendarEventsService to manage the CalendarAssignee join-table
  // rows (assigneeIds array) when creating or updating a calendar event.
  providers: [CalendarEventsService, CalendarAssigneeService], // handles database operations
  exports: [CalendarEventsService], // expose CalendarEventsService to other modules that may need it
})
export class CalendarEventsModule {}
