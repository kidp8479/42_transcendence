import { Injectable } from "@nestjs/common";

// ProjectsService (scaffolding phase)
@Injectable()
export class ProjectsService {
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(dto: CreateProjectDto)
  //       => insert a new project in the database
  //       => default status: IN_PROGRESS
  //       => optional fields: description, deadline, isArchived
  // TODO: findAll(userId: string)
  //       => fetch all projects belonging to a user
  //       => includes filtering (status, archived) later
  // TODO: findById(id: string)
  //       => fetch one project by its id
  //       => ensure project exists
  // TODO: update(id: string, dto: UpdateProjectDto)
  //       => update project fields (name, status, deadline, isArchived)
  //       => partial update (only provided fields)
  // TODO: remove(id: string)
  //       => delete a project permanently
}
