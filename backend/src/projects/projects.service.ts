// ProjectsService: handles all database operations for projects
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class ProjectsService {
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(dto: CreateProjectDto, userId: string)
  //       => insert a new project in the database
  //       => default status: IN_PROGRESS (set by Prisma schema, not the DTO)
  //       => optional fields: description, deadline, isArchived
  //       => must also create a ProjectMember row linking userId to the new project
  // TODO: findAll(userId: string)
  //       => fetch all projects where userId is a ProjectMember
  // TODO: findById(id: string, userId: string)
  //       => fetch one project by its id
  //       => must throw (ex: NotFoundException) if userId is not a ProjectMember of this project,
  //          so membership is enforced here, not just trusted from the controller
  // TODO: update(id: string, dto: UpdateProjectDto, userId: string)
  //       => update project fields (name, status, deadline, isArchived)
  //       => same membership check as findById
  // TODO: remove(id: string, userId: string)
  //       => permanently delete a project
  //       => same membership check as findById
}
