// EvaluationChecklistItemsService: handles all database operations for EvaluationChecklistItems
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EvaluationChecklistItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(projectId: string) {
    return this.prisma.project.findMany({
      where: {
        members: {
          some: { projectId }
        }
      },
    });
  }


  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(projectId: string, dto: CreateEvaluationChecklistItemDto, userId: string)
  //       => must throw (ex: NotFoundException) if userId is not a ProjectMember of projectId
  //       => insert a new checklist item in the database, linked to projectId from the URL
  // TODO: findAll(projectId: string, userId: string)
  //       => must throw if userId is not a ProjectMember of projectId
  //       => fetch all checklist items belonging to a given project
  // TODO: findById(id: string, userId: string)
  //       => must throw if userId is not a ProjectMember of this item's project
  //       => fetch one checklist item by its id
  // TODO: update(id: string, dto: UpdateEvaluationChecklistItemDto, userId: string)
  //       => same membership check as findById
  //       => update an existing item (label, section, or isChecked)
  // TODO: remove(id: string, userId: string)
  //       => same membership check as findById
  //       => permanently delete a checklist item
}
