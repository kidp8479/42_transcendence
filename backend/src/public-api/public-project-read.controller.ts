import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import { ProjectApiTokenAuthenticated } from "../auth/project-api-token.decorator";
import { CalendarEventsService } from "../calendar-events/calendar-events.service";
import { DiscoveryBlocksService } from "../discovery-blocks/discovery-blocks.service";
import { TasksService } from "../tasks/tasks.service";

@ApiSecurity("project-api-key")
@Controller("public/v1/projects/:projectId")
export class PublicProjectReadController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly calendarEventsService: CalendarEventsService,
    private readonly discoveryBlocksService: DiscoveryBlocksService
  ) {}

  @Get("tasks")
  @ProjectApiTokenAuthenticated("READ")
  tasks(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.tasksService.findAllForProject(projectId, pageSize(limit));
  }

  @Get("tasks/:taskId")
  @ProjectApiTokenAuthenticated("READ")
  task(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string
  ) {
    return this.tasksService.findByIdForProject(taskId, projectId);
  }

  @Get("calendar-events")
  @ProjectApiTokenAuthenticated("READ")
  calendarEvents(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.calendarEventsService.findAllForProject(
      projectId,
      pageSize(limit)
    );
  }

  @Get("calendar-events/:eventId")
  @ProjectApiTokenAuthenticated("READ")
  calendarEvent(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string
  ) {
    return this.calendarEventsService.findByIdForProject(eventId, projectId);
  }

  @Get("discovery-blocks")
  @ProjectApiTokenAuthenticated("READ")
  discoveryBlocks(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.discoveryBlocksService.findAllForProject(
      projectId,
      pageSize(limit)
    );
  }
}

function pageSize(value: number | undefined): number {
  if (!value || value < 1) {
    return 100;
  }
  return Math.min(value, 100);
}
