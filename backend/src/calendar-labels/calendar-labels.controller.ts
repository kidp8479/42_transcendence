// CalendarLabelsController: handles all HTTP requests under /api/projects/:projectId/calendar-labels
// one method per route - delegates all database work to CalendarLabelsService
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/calendar-labels")
export class CalendarLabelsController {
  // TODO: inject CalendarLabelsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/calendar-labels
  //        => create a new calendar label for this project
  //        => expects a request body matching CreateCalendarLabelDto (name, color)
  //        => projectId comes from the URL, not the body
  // GET    /api/projects/:projectId/calendar-labels
  //        => get all calendar labels for a project
  //        => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  // GET    /api/projects/:projectId/calendar-labels/:id
  //        => get one calendar label by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/projects/:projectId/calendar-labels/:id
  //        => update a calendar label (name or color)
  //        => expects a request body matching UpdateCalendarLabelDto (all fields optional)
  // DELETE /api/projects/:projectId/calendar-labels/:id
  //        => delete a calendar label by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)
}
