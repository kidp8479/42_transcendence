import { ProjectStatus } from "@prisma/client";

// TODO: Decide validation stratgey for dto's (same as CreateProjectDto)
// class validator or something else
// possible refactor to replace manual dto with:
//  UpdateProjectDto extends PartialType(CreateProjectDto)
//  (requies npm install @nestjs/mapped-types)
// Current state: simple scaffolding dto (no validation, no inheritance)
export class UpdateProjectDto {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  deadline?: string;
  isArchived?: boolean;
}
