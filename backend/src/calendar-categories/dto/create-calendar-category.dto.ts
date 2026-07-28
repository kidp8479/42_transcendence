// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/calendar-categories), not the request body.

import { IsIn, IsInt, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export const CALENDAR_CATEGORY_NAME_MAX_LENGTH = 50;
// matches CATEGORY_COLOR_PALETTE's 0-7 range on the frontend (see
// categoryColorPalette.ts) - same bound as Discovery's own color field
export const CALENDAR_CATEGORY_COLOR_INDICES = [
  0, 1, 2, 3, 4, 5, 6, 7,
] as const;

export class CreateCalendarCategoryDto {
  // trims before MinLength so a whitespace-only name can't pass as real
  // content (same reasoning as CreateDiscoveryBlockDto.title)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(CALENDAR_CATEGORY_NAME_MAX_LENGTH)
  name: string;

  @IsInt()
  @IsIn(CALENDAR_CATEGORY_COLOR_INDICES)
  color: number;
}
