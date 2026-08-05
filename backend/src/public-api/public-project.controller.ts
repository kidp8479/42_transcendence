import {
  Controller,
  Body,
  Delete,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import type {
  MachineTaskMutationActor,
  ProjectApiTokenRequest,
} from "../auth/authenticated-request";
import { ProjectApiTokenAuthenticated } from "../auth/project-api-token.decorator";
import { ProjectApiTokenWriteRateLimitGuard } from "../auth/project-api-token-write-rate-limit.guard";
import { CalendarEventsService } from "../calendar-events/calendar-events.service";
import { DiscoveryBlocksService } from "../discovery-blocks/discovery-blocks.service";
import { TasksService } from "../tasks/tasks.service";
import { CreateTaskDto } from "../tasks/dto/create-task.dto";
import { UpdateTaskDto } from "../tasks/dto/update-task.dto";

@ApiSecurity("project-api-key")
@Controller("public/v1/projects/:projectId")
export class PublicProjectController {
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

  @Post("tasks")
  @ProjectApiTokenAuthenticated("READ_WRITE")
  @UseGuards(ProjectApiTokenWriteRateLimitGuard)
  createTask(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() request: ProjectApiTokenRequest
  ) {
    return this.tasksService.createForMachine(
      projectId,
      dto,
      machineActor(request)
    );
  }

  @Patch("tasks/:taskId")
  @ProjectApiTokenAuthenticated("READ_WRITE")
  @UseGuards(ProjectApiTokenWriteRateLimitGuard)
  updateTask(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() request: ProjectApiTokenRequest
  ) {
    return this.tasksService.updateForMachine(
      taskId,
      dto,
      projectId,
      machineActor(request)
    );
  }

  @Delete("tasks/:taskId")
  @ProjectApiTokenAuthenticated("READ_WRITE")
  @UseGuards(ProjectApiTokenWriteRateLimitGuard)
  deleteTask(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Req() request: ProjectApiTokenRequest
  ) {
    return this.tasksService.removeForMachine(
      taskId,
      projectId,
      machineActor(request)
    );
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

function machineActor(
  request: ProjectApiTokenRequest
): MachineTaskMutationActor {
  return { kind: "MACHINE", tokenId: request.apiToken.tokenId };
}
