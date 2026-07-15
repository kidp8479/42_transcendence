// ProjectsService: handles all database operations for projects
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // fetch all projects where userId is a ProjectMember
  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
    });
  }

  // TODO: create(dto: CreateProjectDto, userId: string)
  //       => insert a new project in the database
  //       => default status: IN_PROGRESS (set by Prisma schema, not the DTO)
  //       => optional fields: description, deadline, isArchived
  //       => must also create a ProjectMember row linking userId to the new project

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
