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
  // TODO: create(projectId: string, dto: CreateCalendarEventDto, userId: string)
  //       => must throw (ex: NotFoundException) if userId is not a ProjectMember of projectId
  //       => insert a new calendar event in the database
  //       => if dto.assigneeIds is provided, call calendarAssigneeService.replaceAssignees(event.id, dto.assigneeIds)
  // TODO: findAll(projectId: string, userId: string)
  //       => must throw if userId is not a ProjectMember of projectId
  //       => fetch all events belonging to a given project
  // TODO: findById(id: string, userId: string)
  //       => must throw if userId is not a ProjectMember of this event's project
  //       => fetch one event by its id
  // TODO: update(id: string, dto: UpdateCalendarEventDto, userId: string)
  //       => same membership check as findById
  //       => update an existing event
  //       => if dto.assigneeIds is provided, call calendarAssigneeService.replaceAssignees(id, dto.assigneeIds)
  // TODO: remove(id: string, userId: string)
  //       => same membership check as findById
  //       => permanently delete a calendar event
}
