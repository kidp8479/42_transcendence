// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// Separate from UpdateProjectDto (status/isArchived) on purpose: both routes
// are OWNER/ADMIN-only, but keeping this as its own DTO/method scopes the
// optimistic-concurrency check (updatedAt below) to name/description edits
// only, instead of forcing every update() caller to start sending it too.

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
  // string | null | undefined: null means "clear it" (sent explicitly by
  // the edit form when the field is left blank) and is passed straight
  // through to Prisma, which writes NULL. undefined means "not included in
  // this request" and leaves the column untouched - IsOptional() treats
  // both the same way (skips validation), so this needs no extra
  // decorator, unlike UpdateTaskDto's ValidateIf workaround for its
  // non-nullable columns.
  description?: string | null;

  @IsDateString()
  updatedAt: string;
}
