import { PartialType } from "@nestjs/mapped-types";
import { CreateProjectDto } from "./create-project.dto";

// Update DTO:
// Reuses CreateProjectDto but makes every field optional for PATCH requests.
// CreateProjectDto defines the fields and validation rules.
// UpdateProjectDto inherits all of those rules and automatically makes every field optional,
// so you don't have to duplicate them.
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
