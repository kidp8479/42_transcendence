import { TaskStatus } from "@prisma/client";
import { TaskPriority } from "@prisma/client";

import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsString()
  categoryId: string;

  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsEnum(TaskPriority)
  priority: TaskPriority;

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
