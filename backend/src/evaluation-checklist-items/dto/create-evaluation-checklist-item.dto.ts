// A DTO (Data Transfer Object) is just a description of the shape of the data you expect to receive.
// It's a simple object that says "when someone sends me data, it must look like this."
// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/evaluation-checklist-items), not the request body.
// isChecked is not here: it is always false at creation, handled by @default(false) in the database schema.
// order: the frontend sends the initial position of the item in the list (0-based index).

import {
  IsInt,
  IsString,
  IsEnum,
  Min,
  MinLength,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { EvaluationChecklistItemSection } from "@prisma/client";
import { EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH } from "../evaluation-checklist-items.constants";

export class CreateEvaluationChecklistItemDto {
  // Trims before MinLength runs, so whitespace-only labels can't pass validation.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH)
  label: string;

  // Must be one of the Prisma enum's own values (MANDATORY/BONUS/SUPPLEMENTAL) -
  // rejects any other string instead of silently accepting garbage.
  @IsEnum(EvaluationChecklistItemSection)
  section: EvaluationChecklistItemSection;

  // 0-based position within its section, set by the frontend from the
  // current list length - Min(0) just guards against a negative value.
  @Min(0)
  @IsInt()
  order: number;
}
