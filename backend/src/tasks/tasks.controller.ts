// HTTP routes for a project's tasks. projectId always comes from the URL;
// categoryId and assigneeIds stay in the body since they're relations, not the
// parent scope. Every route checks membership in the service before touching
// data, so switching :projectId in the URL can't leak or edit another project's
// tasks (IDOR).

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
} from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { TasksService } from "./tasks.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

@Controller("projects/:projectId/tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // create a task in this project
  @ApiSecurity("csrf")
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tasksService.create(projectId, dto, request.user.id);
  }

  // list this project's tasks, grouped by status column and ordered by rank
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tasksService.findAll(projectId, request.user.id);
  }

  // get one task
  @Get(":id")
  findById(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tasksService.findById(id, projectId, request.user.id);
  }

  // update a task - also how a drag-and-drop persists, by sending { status, rank }
  @ApiSecurity("csrf")
  @Patch(":id")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tasksService.update(id, dto, projectId, request.user.id);
  }

  // delete a task (returns the deleted row, so 200 not 204)
  @ApiSecurity("csrf")
  @Delete(":id")
  delete(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tasksService.remove(id, projectId, request.user.id);
  }
}
