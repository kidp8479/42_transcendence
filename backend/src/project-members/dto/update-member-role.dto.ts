import { IsEnum } from "class-validator";

// Roles that can be assigned through member role management.
// OWNER is intentionally excluded because ownership changes are a separate
// operation and should not happen through this endpoint.
enum ProjectMemberRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export class UpdateMemberRoleDto {
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
