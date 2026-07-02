// EvaluationChecklistItemsController: handles all HTTP requests under /api/projects/:projectId/evaluation-checklist-items
// one method per route - delegates all database work to EvaluationChecklistItemsService
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/evaluation-checklist-items")
export class EvaluationChecklistItemsController {
  // TODO: inject EvaluationChecklistItemsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/evaluation-checklist-items
  //        => create a new checklist item
  //        => expects a request body matching CreateEvaluationChecklistItemDto (label, section, order)
  //        => projectId comes from the URL, not the body
  // GET    /api/projects/:projectId/evaluation-checklist-items
  //        => get all items for a project
  //        => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  // GET    /api/projects/:projectId/evaluation-checklist-items/:id
  //        => get one item by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/projects/:projectId/evaluation-checklist-items/:id
  //        => update an existing item (main use case: checking or unchecking)
  //        => expects a request body matching UpdateEvaluationChecklistItemDto (all fields optional)
  // DELETE /api/projects/:projectId/evaluation-checklist-items/:id
  //        => delete an item by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)
}
