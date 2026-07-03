// CalendarEventsService: handles all database operations for CalendarEvents
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class CalendarEventsService {
  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // TODO: inject CalendarAssigneeService here via constructor
  // TODO: create(dto: CreateCalendarEventDto)
  //       => insert a new calendar event in the database
  //       => if dto.assigneeIds is provided, call calendarAssigneeService.replaceAssignees(event.id, dto.assigneeIds)
  // TODO: findAll(projectId: string)
  //       => fetch all events belonging to a given project
  // TODO: findById(id: string)
  //       => fetch one event by its id
  // TODO: update(id: string, dto: UpdateCalendarEventDto)
  //       => update an existing event
  //       => if dto.assigneeIds is provided, call calendarAssigneeService.replaceAssignees(id, dto.assigneeIds)
  // TODO: remove(id: string)
  //       => permanently delete a calendar event
}
