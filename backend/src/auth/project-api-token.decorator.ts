import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import type { ProjectApiTokenPermission } from "./authenticated-request";
import { PROJECT_API_TOKEN_PERMISSION_KEY } from "./project-api-token.constants";
import { ProjectApiTokenGuard } from "./project-api-token.guard";

export const ProjectApiTokenAuthenticated = (
  permission: ProjectApiTokenPermission
) =>
  applyDecorators(
    SetMetadata(PROJECT_API_TOKEN_PERMISSION_KEY, permission),
    UseGuards(ProjectApiTokenGuard)
  );
