// DiscoveryBlockItemsController: handles all HTTP requests under /api/projects/:projectId/discovery-blocks/:discoveryBlockId/items
// one method per route - delegates all database work to DiscoveryBlockItemsService
// note: projectId and discoveryBlockId always come from the URL, never from the request body
// note: when implementing, validate :projectId, :discoveryBlockId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: :projectId alone does not prove access - every route must also confirm
// req.user.id is a member of that project (ProjectMember), AND that :discoveryBlockId
// actually belongs to :projectId, before returning/changing anything. Otherwise any
// authenticated user could read or modify another project's items just by changing
// the ids in the URL (IDOR).

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
import { DiscoveryBlockItemsService } from "./discovery-block-items.service";
import { CreateDiscoveryBlockItemDto } from "./dto/create-discovery-block-item.dto";
import { UpdateDiscoveryBlockItemDto } from "./dto/update-discovery-block-item.dto";

@Controller("projects/:projectId/discovery-blocks/:discoveryBlockId/items")
export class DiscoveryBlockItemsController {
  discoveryBlockItemsService: DiscoveryBlockItemsService;
  constructor(discoveryBlockItemsService: DiscoveryBlockItemsService) {
    this.discoveryBlockItemsService = discoveryBlockItemsService;
  }

  // GET (all)
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("discoveryBlockId", ParseUUIDPipe) discoveryBlockId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockItemsService.findAll(
      projectId,
      discoveryBlockId,
      request.user.id
    );
  }

  // GET (one)
  @Get(":id")
  findById(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("discoveryBlockId", ParseUUIDPipe) discoveryBlockId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockItemsService.findById(
      projectId,
      discoveryBlockId,
      id,
      request.user.id
    );
  }

  // POST
  @ApiSecurity("csrf")
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("discoveryBlockId", ParseUUIDPipe) discoveryBlockId: string,
    @Body() dto: CreateDiscoveryBlockItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockItemsService.create(
      projectId,
      discoveryBlockId,
      dto,
      request.user.id
    );
  }

  // PATCH
  @ApiSecurity("csrf")
  @Patch(":id")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("discoveryBlockId", ParseUUIDPipe) discoveryBlockId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscoveryBlockItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockItemsService.update(
      projectId,
      discoveryBlockId,
      id,
      dto,
      request.user.id
    );
  }

  // DELETE
  @ApiSecurity("csrf")
  @Delete(":id")
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("discoveryBlockId", ParseUUIDPipe) discoveryBlockId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.discoveryBlockItemsService.remove(
      projectId,
      discoveryBlockId,
      id,
      request.user.id
    );
  }
}
