// HTTP routes for a project's task categories, the labels the Kanban board
// colours its cards by. projectId always comes from the URL, never the body.
// Membership is checked in the service before any data is touched, so switching
// :projectId in the URL can't leak another project's categories (IDOR).
//
// Read-only for now: the categories are the defaults seeded by
// ProjectsService.create(), and no screen creates or edits them yet. The
// POST/PATCH/DELETE routes land with the project-settings screen - the DTOs
// (CreateTaskCategoryDto, UpdateTaskCategoryDto) already exist and wait for
// them, and CalendarCategoriesController is the shape to follow.

import { Controller, Get, Param, ParseUUIDPipe, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { TaskCategoriesService } from "./task-categories.service";

@Controller("projects/:projectId/task-categories")
export class TaskCategoriesController {
  constructor(private readonly taskCategoriesService: TaskCategoriesService) {}

  // list this project's task categories
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.taskCategoriesService.findAll(projectId, request.user.id);
  }
}
