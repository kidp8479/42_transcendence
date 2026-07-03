// TaskCategoriesService: handles all database operations for TaskCategories
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class TaskCategoriesService {
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(projectId: string, dto: CreateTaskCategoryDto)
  //       => insert a new task category in the database, linked to projectId from the URL
  // TODO: findAll(projectId: string)
  //       => fetch all task categories belonging to a given project
  // TODO: findById(id: string)
  //       => fetch one task category by its id
  // TODO: update(id: string, dto: UpdateTaskCategoryDto)
  //       => update a category (name or color)
  // TODO: remove(id: string)
  //       => permanently delete a task category
}
