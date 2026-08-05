// HTTP routes for a project's calendar labels ("categories"). projectId
// always comes from the URL, never the body. Every route checks membership
// in the service before touching data, so switching :projectId in the URL
// can't leak or edit another project's labels (IDOR).

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
import { CalendarCategoriesService } from "./calendar-categories.service";
import { CreateCalendarCategoryDto } from "./dto/create-calendar-category.dto";
import { UpdateCalendarCategoryDto } from "./dto/update-calendar-category.dto";

@Controller("projects/:projectId/calendar-categories")
export class CalendarCategoriesController {
  constructor(
    private readonly calendarCategoriesService: CalendarCategoriesService
  ) {}

  // create a label for this project
  @ApiBearerAuth("access-token")
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

  // list this project's labels
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarCategoriesService.findAll(projectId, request.user.id);
  }

  // get one label
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

  // rename or recolor a label
  @ApiBearerAuth("access-token")
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

  // delete a label (returns the deleted row, so 200 not 204)
  @ApiBearerAuth("access-token")
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
