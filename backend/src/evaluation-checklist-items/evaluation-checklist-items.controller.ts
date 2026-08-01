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
  Headers,
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

  // GET (all) - lists every checklist item for the project, all three
  // sections mixed together (the frontend groups them by section itself).
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.findAll(projectId, request.user.id);
  }

  // GET (one) - fetches a single item; also the pattern reused as the
  // ownership guard by update/remove (see findById in the service).
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

  // POST - creates a new item in the given section, rejected once that
  // section already has EVALUATION_CHECKLIST_MAX_ITEMS_PER_SECTION items.
  @ApiSecurity("csrf")
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateEvaluationChecklistItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.create(projectId, dto, request.user.id);
  }

  // PATCH - partial update (label, isChecked, or order); section can't be
  // changed here, see UpdateEvaluationChecklistItemDto.
  @ApiSecurity("csrf")
  @Patch(":id")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationChecklistItemDto,
    @Headers("x-field-lock-token") fieldLockToken: string | undefined,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.update(
      projectId,
      id,
      dto,
      request.user.id,
      fieldLockToken
    );
  }

  // DELETE - permanently removes the item.
  @ApiSecurity("csrf")
  @Delete(":id")
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-field-lock-token") fieldLockToken: string | undefined,
    @Req() request: AuthenticatedRequest
  ) {
    return this.evaluationChecklistItem.remove(
      projectId,
      id,
      request.user.id,
      fieldLockToken
    );
  }
}
