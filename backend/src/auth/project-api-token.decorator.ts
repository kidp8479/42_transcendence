import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import type { ProjectApiTokenPermission } from "./authenticated-request";
import {
  PROJECT_API_TOKEN_PERMISSION_KEY,
  PROJECT_API_TOKEN_SELF_KEY,
} from "./project-api-token.constants";
import { ProjectApiTokenGuard } from "./project-api-token.guard";

export const ProjectApiTokenAuthenticated = (
  permission: ProjectApiTokenPermission
) =>
  applyDecorators(
    SetMetadata(PROJECT_API_TOKEN_PERMISSION_KEY, permission),
    UseGuards(ProjectApiTokenGuard)
  );

export const ProjectApiTokenSelfAuthenticated = () =>
  applyDecorators(
    SetMetadata(PROJECT_API_TOKEN_SELF_KEY, true),
    UseGuards(ProjectApiTokenGuard)
  );
