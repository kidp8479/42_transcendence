// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/tasks), not the request body.
// assigneeIds are handled internally by TaskAssigneeService when provided.

import { TaskStatus } from "@prisma/client";
import { TaskPriority } from "@prisma/client";
import {
  maxTaskTitleLength,
  maxTaskDescriptionLength,
  maxTaskNotesLength,
} from "../tasks.constants";

import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";
// Package root, not a deep path into class-transformer/types/*: that directory
// ships only .d.ts files, so a deep import typechecks and then throws
// MODULE_NOT_FOUND at boot.
import { Transform } from "class-transformer";

export class CreateTaskDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, maxTaskTitleLength)
  title: string;

  @IsUUID("4")
  categoryId: string;

  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsEnum(TaskPriority)
  priority: TaskPriority;

  // 0-based position of the task inside its STATUS column - the Kanban board
  // groups by status, not by category. The frontend sends the wanted position
  // on creation; the service shifts the siblings to make room and keeps every
  // column dense (0..n-1).
  @IsInt()
  @Min(0)
  rank: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  // Trimmed like title, so whitespace-only input lands as an empty field rather
  // than as invisible content. It stays ACCEPTED here, unlike title: @Length
  // starts at 0 for these two, and "no description" is a legitimate state.
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(0, maxTaskDescriptionLength)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(0, maxTaskNotesLength)
  notes?: string;

  @IsBoolean()
  onCalendar: boolean;

  @IsOptional()
  @IsUUID("4", { each: true })
  @IsArray()
  @ArrayUnique()
  assigneeIds?: string[];
}
