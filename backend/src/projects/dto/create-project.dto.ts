// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projects have no parent resource: they are top-level, so no parentId in the URL or body.
// status is not required: it defaults to IN_PROGRESS in the Prisma schema.
// isArchived is not required: it defaults to false in the Prisma schema.

import { ProjectStatus } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus; // defaults to IN_PROGRESS in Prisma

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
