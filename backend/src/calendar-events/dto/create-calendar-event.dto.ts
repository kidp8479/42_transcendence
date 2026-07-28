// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/calendar-events), not the request body.
// assigneeIds are handled internally by CalendarAssigneeService when provided.

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
  // trims before MinLength so a whitespace-only title can't pass as real
  // content (same reasoning as CreateDiscoveryBlockDto.title)
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
