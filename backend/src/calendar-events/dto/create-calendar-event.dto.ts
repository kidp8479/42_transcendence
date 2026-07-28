// projectId isn't here: it comes from the URL, not the body.
// assigneeIds are handled by CalendarAssigneeService, not a column here.

import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

export const CALENDAR_EVENT_TITLE_MAX_LENGTH = 100;
export const CALENDAR_EVENT_DESCRIPTION_MAX_LENGTH = 500;
export const CALENDAR_EVENT_NOTES_MAX_LENGTH = 2000;

export class CreateCalendarEventDto {
  // trim first so a whitespace-only title doesn't pass MinLength as real content
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(CALENDAR_EVENT_TITLE_MAX_LENGTH)
  title: string;

  @IsUUID("4")
  categoryId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(CALENDAR_EVENT_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CALENDAR_EVENT_NOTES_MAX_LENGTH)
  notes?: string;

  @IsOptional()
  @IsUUID("4", { each: true })
  @IsArray()
  @ArrayUnique()
  assigneeIds?: string[];
}
