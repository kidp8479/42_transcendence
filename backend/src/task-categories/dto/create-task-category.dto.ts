// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/task-categories), not the request body.

import { IsIn, IsInt, IsString, Length } from "class-validator";
import { Transform } from "class-transformer";

export const maxTaskCategoryNameLength = 50;
// index into the frontend's colour palette (lib/categoryColorPalette.ts), which
// has exactly 8 entries - anything else renders as the fallback colour
export const taskCategoryColorIndices = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export class CreateTaskCategoryDto {
  // trim first, so a whitespace-only name can't pass the length check as if it
  // were real content
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, maxTaskCategoryNameLength)
  name: string;

  // IsInt + IsIn, not IsNumber: IsNumber would accept 3.5 and -1, which index
  // nothing in the palette.
  @IsInt()
  @IsIn(taskCategoryColorIndices)
  color: number;
}
