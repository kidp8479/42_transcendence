// CalendarEventsController: handles all HTTP requests under /api/projects/:projectId/calendar-events
// one method per route - delegates all database work to CalendarEventsService
// note: projectId always comes from the URL, never from the request body
// note: categoryId and assigneeIds stay in the body (they are relations, not the parent scope)
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :projectId alone does not prove access - every route must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project's
// calendar events just by changing the projectId in the URL (IDOR).

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
import { CalendarEventsService } from "./calendar-events.service";
import { CreateCalendarEventDto } from "./dto/create-calendar-event.dto";
import { UpdateCalendarEventDto } from "./dto/update-calendar-event.dto";

@Controller("projects/:projectId/calendar-events")
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  // POST /api/projects/:projectId/calendar-events => create a new event
  @ApiSecurity("csrf")
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateCalendarEventDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.create(projectId, dto, request.user.id);
  }

  // GET /api/projects/:projectId/calendar-events => all events for a project
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.findAll(projectId, request.user.id);
  }

  // GET /api/projects/:projectId/calendar-events/:id => one event by id
  @Get(":id")
  findById(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.findById(id, projectId, request.user.id);
  }

  // PATCH /api/projects/:projectId/calendar-events/:id => update an existing event
  @ApiSecurity("csrf")
  @Patch(":id")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarEventDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.update(
      id,
      dto,
      projectId,
      request.user.id
    );
  }

  // DELETE /api/projects/:projectId/calendar-events/:id => delete an event
  // returns the deleted event's own body (200, not 204), same convention as
  // DiscoveryBlocksController's delete
  @ApiSecurity("csrf")
  @Delete(":id")
  delete(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.remove(id, projectId, request.user.id);
  }
}
