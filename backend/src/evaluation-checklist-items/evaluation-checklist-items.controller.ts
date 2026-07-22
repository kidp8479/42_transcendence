// EvaluationChecklistItemsController: handles all HTTP requests under /api/projects/:projectId/evaluation-checklist-items
// one method per route - delegates all database work to EvaluationChecklistItemsService
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :projectId alone does not prove access - every route must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project's
// checklist items just by changing the projectId in the URL (IDOR).

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Req,
  Body,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { EvaluationChecklistItemsService } from "./evaluation-checklist-items.service";
import { CreateEvaluationChecklistItemDto } from "./dto/create-evaluation-checklist-item.dto";
import { UpdateEvaluationChecklistItemDto } from "./dto/update-evaluation-checklist-item.dto";

@Controller("projects/:projectId/evaluation-checklist-items")
export class EvaluationChecklistItemsController {
  evaluationChecklistItem: EvaluationChecklistItemsService;
  constructor(evaluationChecklistItem: EvaluationChecklistItemsService) {
    this.evaluationChecklistItem = evaluationChecklistItem;
  }

  // GET (all)
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.findAll(projectId, request.user.id);
  }

  // GET (one)
  @Get(":id")
  findById(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.findById(
      projectId,
      id,
      request.user.id
    );
  }

  // POST
  @ApiSecurity("csrf")
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateEvaluationChecklistItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.create(projectId, dto, request.user.id);
  }

  // PATCH
  @Patch(":id")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationChecklistItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.update(
      projectId,
      id,
      dto,
      request.user.id
    );
  }

  // DELETE
  @Delete(":id")
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.remove(projectId, id, request.user.id);
  }
}
