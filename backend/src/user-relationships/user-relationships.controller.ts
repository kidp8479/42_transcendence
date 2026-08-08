import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  Req,
  ParseUUIDPipe,
} from "@nestjs/common";

import { ApiBearerAuth } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { UserRelationshipsService } from "./user-relationships.service";
import { UpdateUserRelationshipDto } from "./dto/update-user-relationship.dto";

// `:id` on every route below is the OTHER user's id, never the caller's own
// id and never a UserRelationship row's own id - the pair (caller, :id) is
// what identifies the relationship.
@Controller("users/user-relationships")
export class UserRelationshipsController {
  constructor(
    private readonly userRelationshipService: UserRelationshipsService
  ) {}

  @Get()
  @ApiBearerAuth("access-token")
  findAll(@Req() request: AuthenticatedRequest) {
    return this.userRelationshipService.findAll(request.user.id);
  }

  @Get(":id")
  @ApiBearerAuth("access-token")
  findById(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.userRelationshipService.findById(id, request.user.id);
  }

  @Post(":id")
  @ApiBearerAuth("access-token")
  create(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.userRelationshipService.create(id, request.user.id);
  }

  @Patch(":id")
  @ApiBearerAuth("access-token")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRelationshipDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.userRelationshipService.update(id, dto, request.user.id);
  }

  @Delete(":id")
  @ApiBearerAuth("access-token")
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.userRelationshipService.remove(id, request.user.id);
  }
}
