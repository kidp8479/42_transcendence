// EvaluationChecklistItemsController: handles all HTTP requests under /api/evaluation-checklist-items
// one method per route - delegates all database work to EvaluationChecklistItemsService

import { Controller } from "@nestjs/common";

@Controller("calendar-events")
export class CalendarEventsController {
  // TODO: inject EvaluationChecklistItemsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/evaluation-checklist-items
  //        => create a new checklist item
  //        => expects a request body matching CreateEvaluationChecklistItemDto (projectId, label, section)
  // GET    /api/evaluation-checklist-items
  //        => get all items for a project
  //        => expects ?projectId=... as a URL query param (no request body, no DTO)
  // GET    /api/evaluation-checklist-items/:id
  //        => get one item by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/evaluation-checklist-items/:id
  //        => update an existing item (main use case: checking or unchecking)
  //        => expects a request body matching UpdateEvaluationChecklistItemDto (all fields optional)
  // DELETE /api/evaluation-checklist-items/:id
  //        => delete an item by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
