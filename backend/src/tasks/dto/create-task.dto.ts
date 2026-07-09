// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/tasks), not the request body.
// assigneeIds are handled internally by TaskAssigneeService when provided.

import { TaskStatus } from "@prisma/client";
import { TaskPriority } from "@prisma/client";

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
} from "class-validator";

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsUUID("4")
  categoryId: string;

  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsEnum(TaskPriority)
  priority: TaskPriority;

  // position of the task in its category column (0-based)
  // frontend sends the initial rank on creation, same pattern as order in
  // CreateDiscoveryBlockItemDto and CreateEvaluationChecklistItemDto
  @IsInt()
  rank: number;

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

  @IsBoolean()
  onCalendar: boolean;

  @IsOptional()
  @IsUUID("4", { each: true })
  @IsArray()
  @ArrayUnique()
  assigneeIds?: string[];
}
