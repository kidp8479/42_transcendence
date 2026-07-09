// CalendarEventsController: handles all HTTP requests under /api/projects/:projectId/calendar-events
// one method per route - delegates all database work to CalendarEventsService
// note: projectId always comes from the URL, never from the request body
// note: categoryId and assigneeIds stay in the body (they are relations, not the parent scope)
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :projectId alone does not prove access - every route must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project's
// calendar events just by changing the projectId in the URL (IDOR).

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/calendar-events")
export class CalendarEventsController {
  // TODO: inject CalendarEventsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/calendar-events
  //        => create a new calendar event
  //        => expects a request body matching CreateCalendarEventDto (title, categoryId, startAt,
  //           endAt, description?, notes?, assigneeIds?)
  //        => projectId comes from the URL, not the body
  //        => categoryId stays in the body (it's a relation, not the parent scope)
  //        => assigneeIds, if provided, are handled internally via CalendarAssigneeService
  // GET    /api/projects/:projectId/calendar-events
  //        => get all events for a project
  //        => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  // GET    /api/projects/:projectId/calendar-events/:id
  //        => get one event by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/projects/:projectId/calendar-events/:id
  //        => update an existing event (any field, all optional)
  //        => expects a request body matching UpdateCalendarEventDto
  // DELETE /api/projects/:projectId/calendar-events/:id
  //        => delete an event by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)
}
