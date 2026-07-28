// CalendarCategoriesController: handles all HTTP requests under /api/projects/:projectId/calendar-categories
// one method per route - delegates all database work to CalendarCategoriesService
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :projectId alone does not prove access - every route must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project's
// calendar categories just by changing the projectId in the URL (IDOR).

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
import { CalendarCategoriesService } from "./calendar-categories.service";
import { CreateCalendarCategoryDto } from "./dto/create-calendar-category.dto";
import { UpdateCalendarCategoryDto } from "./dto/update-calendar-category.dto";

@Controller("projects/:projectId/calendar-categories")
export class CalendarCategoriesController {
  constructor(
    private readonly calendarCategoriesService: CalendarCategoriesService
  ) {}

  // POST /api/projects/:projectId/calendar-categories => create a label for this project
  @ApiSecurity("csrf")
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateCalendarCategoryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarCategoriesService.create(
      projectId,
      dto,
      request.user.id
    );
  }

  // GET /api/projects/:projectId/calendar-categories => all labels for a project
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarCategoriesService.findAll(projectId, request.user.id);
  }

  // GET /api/projects/:projectId/calendar-categories/:id => one label by id
  @Get(":id")
  findById(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarCategoriesService.findById(
      id,
      projectId,
      request.user.id
    );
  }

  // PATCH /api/projects/:projectId/calendar-categories/:id => update a label's name or color
  @ApiSecurity("csrf")
  @Patch(":id")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarCategoryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarCategoriesService.update(
      id,
      dto,
      projectId,
      request.user.id
    );
  }

  // DELETE /api/projects/:projectId/calendar-categories/:id => delete a label
  // returns the deleted category's own body (200, not 204), same convention as
  // DiscoveryBlocksController's delete
  @ApiSecurity("csrf")
  @Delete(":id")
  delete(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarCategoriesService.remove(
      id,
      projectId,
      request.user.id
    );
  }
}
