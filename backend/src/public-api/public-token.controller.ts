import { Controller, Get, Req } from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import type { ProjectApiTokenRequest } from "../auth/authenticated-request";
import { ProjectApiTokenSelfAuthenticated } from "../auth/project-api-token.decorator";

@ApiSecurity("project-api-key")
@Controller("public/v1/token")
export class PublicTokenController {
  @Get()
  @ProjectApiTokenSelfAuthenticated()
  introspect(@Req() request: ProjectApiTokenRequest) {
    return {
      id: request.apiToken.tokenId,
      projectId: request.apiToken.projectId,
      label: request.apiToken.label,
      permission: request.apiToken.permission,
      expiresAt: request.apiToken.expiresAt,
      lastUsedAt: request.apiToken.lastUsedAt,
      status: "ACTIVE",
    };
  }
}
