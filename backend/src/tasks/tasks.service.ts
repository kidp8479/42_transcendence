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
  // TODO: inject ProjectsService here via constructor (for assertMembership below)
  // TODO: create(projectId: string, dto: CreateTaskDto, userId: string)
  //       => call projectsService.assertMembership(projectId, userId) first (shared check,
  //          throws NotFoundException if not a member - no role required, any member can create a task)
  //       => insert a new task in the database
  //       => if dto.assigneeIds is provided, call taskAssigneeService.replaceAssignees(task.id, dto.assigneeIds)
  // TODO: findAll(projectId: string, userId: string)
  //       => same assertMembership call as create
  //       => fetch all tasks belonging to a given project
  // TODO: findById(id: string, projectId: string, userId: string)
  //       => same assertMembership call as create, then fetch with where: { id, projectId }
  //          (see DiscoveryBlocksService.findById for a full example of this pattern)
  // TODO: update(id: string, dto: UpdateTaskDto, projectId: string, userId: string)
  //       => same membership check as findById
  //       => update an existing task
  //       => if dto.assigneeIds is provided, call taskAssigneeService.replaceAssignees(id, dto.assigneeIds)
  // TODO: remove(id: string, projectId: string, userId: string)
  //       => same membership check as findById
  //       => permanently delete a task
}
