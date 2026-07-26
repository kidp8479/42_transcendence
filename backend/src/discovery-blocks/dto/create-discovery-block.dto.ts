// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/discovery-blocks), not the request body.
// status is not here: it is never set manually - the backend calculates it automatically
// based on checklist progress or note completion TBD (NOT_STARTED => IN_PROGRESS => COMPLETED)

import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

// named constants (not bare numbers in the decorators below) - same point
// raised on Carlos's PR #18 about magic numbers. The frontend edit screen
// mirrors these exact values as its own maxLength attributes, so a client
// can't type past a limit the backend will reject anyway with no feedback
// shown (no toast/notification system yet).
export const DISCOVERY_BLOCK_TITLE_MAX_LENGTH = 100;
export const DISCOVERY_BLOCK_DESCRIPTION_MAX_LENGTH = 500;
export const DISCOVERY_BLOCK_NOTES_MAX_LENGTH = 2000;

export class CreateDiscoveryBlockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(DISCOVERY_BLOCK_TITLE_MAX_LENGTH)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(DISCOVERY_BLOCK_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsString() // no fixed icon set yet - revisit with @IsIn([...]) if an icon library gets chosen
  icon?: string;

  // same representation as TaskCategory.color/CalendarCategory.color: an index into
  // a fixed palette defined on the frontend (not decided yet - revisit with
  // @IsIn([...]) once the palette's size is fixed)
  @IsOptional()
  @IsInt()
  color?: number;

  @IsOptional()
  @IsString()
  @MaxLength(DISCOVERY_BLOCK_NOTES_MAX_LENGTH)
  notes?: string;
}
