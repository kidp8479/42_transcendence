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
  // TODO: create(projectId: string, dto: CreateTaskDto, userId: string)
  //       => must throw (ex: NotFoundException) if userId is not a ProjectMember of projectId
  //       => insert a new task in the database
  //       => if dto.assigneeIds is provided, call taskAssigneeService.replaceAssignees(task.id, dto.assigneeIds)
  // TODO: findAll(projectId: string, userId: string)
  //       => must throw if userId is not a ProjectMember of projectId
  //       => fetch all tasks belonging to a given project
  // TODO: findById(id: string, userId: string)
  //       => must throw if userId is not a ProjectMember of this task's project
  //       => fetch one task by its id
  // TODO: update(id: string, dto: UpdateTaskDto, userId: string)
  //       => same membership check as findById
  //       => update an existing task
  //       => if dto.assigneeIds is provided, call taskAssigneeService.replaceAssignees(id, dto.assigneeIds)
  // TODO: remove(id: string, userId: string)
  //       => same membership check as findById
  //       => permanently delete a task
}
