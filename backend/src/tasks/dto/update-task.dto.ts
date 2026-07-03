// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move a task from one project to another.
// rank is here: updated when the user drags and drops a task to reorder it.
// assigneeIds are handled internally by TaskAssigneeService when provided.

import { TaskStatus } from "@prisma/client";
import { TaskPriority } from "@prisma/client";

import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
} from "class-validator";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  rank?: number;

  @IsOptional()
  @IsBoolean()
  onCalendar?: boolean;
}
