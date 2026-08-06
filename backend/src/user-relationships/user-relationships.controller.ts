import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  Req,
  ParseUUIDPipe
} from "@nestjs/common";

import { ApiBearerAuth } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { UserRelationshipsService } from "./user-relationships.service";
import { CreateUserRelationshipDto } from "./dto/create-user-relationship.dto";
import { UpdateUserRelationshipDto } from "./dto/update-user-relationship.dto";

@Controller("users/user-relationships")
export class UserRelationshipsController {
  constructor(
    private readonly userRelationshipService: UserRelationshipsService
  ) {

  }
  @Get()
  @ApiBearerAuth("access-token")
  async findAll(
    @Req() request: AuthenticatedRequest
  ) {
    return this.userRelationshipService.findAll(request.user.id);
  }

  @Get(":id")
  @ApiBearerAuth("access-token")
  async findById(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.userRelationshipService.findById(id, request.user.id);
  }

}