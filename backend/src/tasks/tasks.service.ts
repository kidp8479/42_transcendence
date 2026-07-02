// TasksService: handles all database operations for Tasks
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class TasksService {
  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // TODO: inject TaskAssigneeService here via constructor
  // TODO: create(dto: CreateTaskDto)
  //       => insert a new task in the database
  //       => if dto.assigneeIds is provided, call taskAssigneeService.replaceAssignees(task.id, dto.assigneeIds)
  // TODO: findAll(categoryId: string)
  //       => fetch all tasks belonging to a given category
  // TODO: findById(id: string)
  //       => fetch one task by its id
  // TODO: update(id: string, dto: UpdateTaskDto)
  //       => update an existing task
  //       => if dto.assigneeIds is provided, call taskAssigneeService.replaceAssignees(id, dto.assigneeIds)
  // TODO: remove(id: string)
  //       => permanently delete a task
}
