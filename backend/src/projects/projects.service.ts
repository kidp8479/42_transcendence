// ProjectsService: handles all database operations for projects
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class ProjectsService {
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(dto: CreateProjectDto)
  //       => insert a new project in the database
  //       => default status: IN_PROGRESS (set by Prisma schema, not the DTO)
  //       => optional fields: description, deadline, isArchived
  // TODO: findAll(userId: string)
  //       => fetch all projects belonging to a user
  // TODO: findById(id: string)
  //       => fetch one project by its id
  // TODO: update(id: string, dto: UpdateProjectDto)
  //       => update project fields (name, status, deadline, isArchived)
  // TODO: remove(id: string)
  //       => permanently delete a project
}
