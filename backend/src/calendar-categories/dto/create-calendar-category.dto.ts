// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/calendar-categories), not the request body.

import { IsIn, IsInt, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export const CALENDAR_CATEGORY_NAME_MAX_LENGTH = 50;
// matches the frontend's color palette (categoryColorPalette.ts), 8 colors
export const CALENDAR_CATEGORY_COLOR_INDICES = [
  0, 1, 2, 3, 4, 5, 6, 7,
] as const;

export class CreateCalendarCategoryDto {
  // trim first so a whitespace-only name doesn't pass MinLength as real content
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(CALENDAR_CATEGORY_NAME_MAX_LENGTH)
  name: string;

  @IsInt()
  @IsIn(CALENDAR_CATEGORY_COLOR_INDICES)
  color: number;
}
