import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateProjectDto } from "./create-project.dto";

// Update DTO:
// Reuses CreateProjectDto but makes every field optional for PATCH requests.
// CreateProjectDto defines the fields and validation rules.
// UpdateProjectDto inherits all of those rules and automatically makes every field optional,
// so you don't have to duplicate them.
//
// name/description are omitted on purpose: they now go through
// PATCH /:id/details (UpdateProjectDetailsDto) instead, which enforces the
// optimistic-concurrency check. Leaving them here would let an OWNER/ADMIN
// silently overwrite a concurrent details edit via this route, bypassing
// that check entirely - forbidNonWhitelisted (main.ts) now rejects them
// with 400 instead.
export class UpdateProjectDto extends PartialType(
  OmitType(CreateProjectDto, ["name", "description"] as const)
) {}
