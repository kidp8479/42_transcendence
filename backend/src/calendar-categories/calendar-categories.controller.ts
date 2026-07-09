// CalendarCategoriesController: handles all HTTP requests under /api/projects/:projectId/calendar-categories
// one method per route - delegates all database work to CalendarCategoriesService
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :projectId alone does not prove access - every route must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project's
// calendar categories just by changing the projectId in the URL (IDOR).

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/calendar-categories")
export class CalendarCategoriesController {
  // TODO: inject CalendarCategoriesService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/calendar-categories
  //        => create a new calendar category for this project
  //        => expects a request body matching CreateCalendarCategoryDto (name, color)
  //        => projectId comes from the URL, not the body
  // GET    /api/projects/:projectId/calendar-categories
  //        => get all calendar categories for a project
  //        => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  // GET    /api/projects/:projectId/calendar-categories/:id
  //        => get one calendar category by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/projects/:projectId/calendar-categories/:id
  //        => update a calendar category (name or color)
  //        => expects a request body matching UpdateCalendarCategoryDto (all fields optional)
  // DELETE /api/projects/:projectId/calendar-categories/:id
  //        => delete a calendar category by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)
}
