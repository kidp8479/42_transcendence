// EvaluationChecklistItemsService: handles all database operations for EvaluationChecklistItems
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class EvaluationChecklistItemsService {
  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(dto: CreateEvaluationChecklistItemDto)
  //       => insert a new checklist item in the database
  // TODO: findAll(projectId: string)
  //       => fetch all checklist items belonging to a given project
  // TODO: findById(id: string)
  //       => fetch one checklist item by its id
  // TODO: update(id: string, dto: UpdateEvaluationChecklistItemDto)
  //       => update an existing item (label, section, or isChecked)
  // TODO: remove(id: string)
  //       => permanently delete a checklist item
}
