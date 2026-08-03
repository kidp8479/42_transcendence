// HTTP routes for a project's calendar events. projectId always comes from
// the URL; categoryId/assigneeIds stay in the body since they're relations,
// not the parent scope. Every route checks membership in the service before
// touching data, so switching :projectId in the URL can't leak or edit
// another project's events (IDOR).

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
import { ApiBearerAuth } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { CalendarEventsService } from "./calendar-events.service";
import { CreateCalendarEventDto } from "./dto/create-calendar-event.dto";
import { UpdateCalendarEventDto } from "./dto/update-calendar-event.dto";

@Controller("projects/:projectId/calendar-events")
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  // create a new event
  @ApiBearerAuth()
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateCalendarEventDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.create(projectId, dto, request.user.id);
  }

  // list this project's events
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.findAll(projectId, request.user.id);
  }

  // get one event
  @Get(":id")
  findById(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.findById(id, projectId, request.user.id);
  }

  // update an existing event
  @ApiBearerAuth()
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

  // delete an event (returns the deleted row, so 200 not 204)
  @ApiBearerAuth()
  @Delete(":id")
  delete(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarEventsService.remove(id, projectId, request.user.id);
  }
}
