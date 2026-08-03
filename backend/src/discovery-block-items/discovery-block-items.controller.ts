// DiscoveryBlockItemsController: handles all HTTP requests under /api/projects/:projectId/discovery-blocks/:discoveryBlockId/items
// one method per route - delegates all database work to DiscoveryBlockItemsService.
// Every :id param is validated with ParseUUIDPipe (malformed id => 400 before
// hitting the database); the real access check (membership + ownership,
// IDOR-safe) happens in the service, see its findById.

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
import { ApiBearerAuth } from "@nestjs/swagger";
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
  @ApiBearerAuth()
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
  @ApiBearerAuth()
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
  @ApiBearerAuth()
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
