// DiscoveryBlocksController: handles all HTTP requests under /api/projects/:projectId/discovery-blocks
// one method per route - delegates all database work to DiscoveryBlocksService
// note: projectId always comes from the URL, never from the request body
// note: when implementing, validate :projectId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :projectId alone does not prove access - every route must also confirm
// req.user.id is a member of that project (ProjectMember) before returning/changing
// anything, otherwise any authenticated user could read or modify any project's
// discovery blocks just by changing the projectId in the URL (IDOR).

import {
  Controller,
  Get,
  Post,
  Patch,
  Req,
  Body,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { DiscoveryBlocksService } from "./discovery-blocks.service";
import { CreateDiscoveryBlockDto } from "./dto/create-discovery-block.dto";
import { UpdateDiscoveryBlockDto } from "./dto/update-discovery-block.dto";

@Controller("projects/:projectId/discovery-blocks")
export class DiscoveryBlocksController {
  discoveryBlockService: DiscoveryBlocksService;
  constructor(discoveryBlockService: DiscoveryBlocksService) {
    this.discoveryBlockService = discoveryBlockService;
  }

  // GET (all)
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockService.findAll(projectId, request.user.id);
  }

  // GET (one)
  @Get(":id")
  findById(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockService.findById(projectId, id, request.user.id);
  }

  // POST
  @ApiSecurity("csrf")
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateDiscoveryBlockDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockService.create(projectId, dto, request.user.id);
  }

  // PATCH
  @ApiSecurity("csrf")
  @Patch(":id")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscoveryBlockDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockService.update(
      projectId,
      id,
      dto,
      request.user.id
    );
  }

  // DELETE /api/projects/:projectId/discovery-blocks/:id
  //        => delete a discovery block by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)

  // TODO
  // @Delete
}
