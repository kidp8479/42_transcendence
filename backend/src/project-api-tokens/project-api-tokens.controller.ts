import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { CreateProjectApiTokenDto } from "./dto/create-project-api-token.dto";
import { ProjectApiTokensService } from "./project-api-tokens.service";

@ApiBearerAuth("access-token")
@Controller("projects/:projectId/api-tokens")
export class ProjectApiTokensController {
  constructor(private readonly tokens: ProjectApiTokensService) {}

  @Get()
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tokens.list(projectId, request.user.id);
  }

  @Post()
  @Header("Cache-Control", "no-store")
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectApiTokenDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tokens.create(projectId, request.user.id, dto);
  }

  @Post(":tokenId/revoke")
  revoke(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("tokenId", ParseUUIDPipe) tokenId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tokens.revoke(projectId, tokenId, request.user.id);
  }

  @Delete(":tokenId")
  @HttpCode(204)
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("tokenId", ParseUUIDPipe) tokenId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tokens.remove(projectId, tokenId, request.user.id);
  }
}
