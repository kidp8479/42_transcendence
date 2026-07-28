// All fields are optional - the caller can update only one field at a time.
// projectId is not here: it comes from the URL (/projects/:projectId/evaluation-checklist-items), not the request body.
// isChecked is not in the create DTO (always false at creation) but lives here, it's the main use case.
// order is updated here when the user drags and drops to reorder items.
// section is intentionally excluded: items never move between sections (not even via future
// drag-and-drop), and allowing it here would let a PATCH bypass the per-section item cap
// enforced in create() - see evaluation-checklist-items.service.ts.

import { PartialType, OmitType } from "@nestjs/mapped-types";
import {
  IsInt,
  IsBoolean,
  IsString,
  IsOptional,
  Min,
  MinLength,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer"
import { CreateEvaluationChecklistItemDto } from "./create-evaluation-checklist-item.dto";
import { EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH } from "../evaluation-checklist-items.constants";

// Reuses CreateEvaluationChecklistItemDto's fields and validation decorators (label, order),
// minus section, makes them optional for PATCH.
// isChecked is added manually below: PartialType only knows about fields that already exist in the create DTO.
export class UpdateEvaluationChecklistItemDto extends PartialType(
  OmitType(CreateEvaluationChecklistItemDto, ["section"] as const)
) {
  // Same constraints as create's label, just optional here.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value ))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH)
  label?: string;

  // Toggling the checkbox - the main thing this route is used for.
  @IsOptional()
  @IsBoolean()
  isChecked?: boolean;

  // Reorder within the same section (drag-and-drop) - see the note above on
  // why section itself can't change alongside it.
  @IsOptional()
  @Min(0)
  @IsInt()
  order?: number;
}
