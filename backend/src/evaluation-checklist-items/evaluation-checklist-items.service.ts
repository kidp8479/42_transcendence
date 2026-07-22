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
  // TODO: inject ProjectsService here via constructor (for assertMembership below)
  // TODO: create(projectId: string, dto: CreateEvaluationChecklistItemDto, userId: string)
  //       => call projectsService.assertMembership(projectId, userId) first (shared check,
  //          throws NotFoundException if not a member - no role required, any member can do this)
  //       => insert a new checklist item in the database, linked to projectId from the URL
  // TODO: findAll(projectId: string, userId: string)
  //       => same assertMembership call as create
  //       => fetch all checklist items belonging to a given project
  // TODO: findById(id: string, projectId: string, userId: string)
  //       => same assertMembership call as create, then fetch with where: { id, projectId }
  //          (see DiscoveryBlocksService.findById for a full example of this pattern)
  // TODO: update(id: string, dto: UpdateEvaluationChecklistItemDto, projectId: string, userId: string)
  //       => same membership check as findById
  //       => update an existing item (label, section, or isChecked)
  // TODO: remove(id: string, projectId: string, userId: string)
  //       => same membership check as findById
  //       => permanently delete a checklist item
}
