// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// Separate from UpdateProjectDto (status/isArchived, OWNER/ADMIN-only) on
// purpose: this route is open to any project member, so it can only ever
// touch name/description, never the fields the stricter route guards.

// updatedAt is not project data - it's the version this edit was based on.
// The service compares it against the current row before writing, so a
// save based on stale data is rejected (409) instead of silently
// overwriting a concurrent edit from someone else.

import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import {
  maxProjectDescriptionLength,
  maxProjectNameLength,
} from "../projects.constants";

export class UpdateProjectDetailsDto {
  @IsString()
  @Length(1, maxProjectNameLength)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(maxProjectDescriptionLength)
  description?: string;

  @IsDateString()
  updatedAt: string;
}
