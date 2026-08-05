import { SetMetadata } from "@nestjs/common";
import type { ProjectApiTokenPermission } from "./authenticated-request";

export const PROJECT_API_TOKEN_PERMISSION_KEY = "projectApiTokenPermission";

export const ProjectApiTokenAuthenticated = (
  permission: ProjectApiTokenPermission
) => SetMetadata(PROJECT_API_TOKEN_PERMISSION_KEY, permission);
