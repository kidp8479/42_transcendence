// CalendarEventsController: handles all HTTP requests under /api/calendar-events
// one method per route - delegates all database work to CalendarEventsService
// note: there is currently no projectId in the URL nor in CreateCalendarEventDto - how an
// event gets scoped to a project (via labelId, which does have a projectId, or via the URL)
// is not decided yet, flag this with the team before implementing the real routes

import { Controller } from "@nestjs/common";

@Controller("calendar-events")
export class CalendarEventsController {
  // TODO: inject CalendarEventsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/calendar-events
  //        => create a new calendar event
  //        => expects a request body matching CreateCalendarEventDto (title, labelId, startAt,
  //           endAt, description?, notes?, assigneeIds?)
  //        => assigneeIds, if provided, are handled internally via CalendarAssigneeService
  // GET    /api/calendar-events
  //        => get all events for a project
  //        => expects ?labelId=... or ?projectId=... as a URL query param (TBD which - see note above)
  // GET    /api/calendar-events/:id
  //        => get one event by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/calendar-events/:id
  //        => update an existing event (any field, all optional)
  //        => expects a request body matching UpdateCalendarEventDto
  // DELETE /api/calendar-events/:id
  //        => delete an event by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
