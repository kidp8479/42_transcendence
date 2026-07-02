// All fields are optional - the caller can update only one field at a time.
// projectId is not here: it comes from the URL (/projects/:projectId/evaluation-checklist-items), not the request body.
// isChecked is not in the create DTO (always false at creation) but lives here, it's the main use case.
// order is updated here when the user drags and drops to reorder items.

import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateEvaluationChecklistItemDto } from "./create-evaluation-checklist-item.dto";

// Reuses CreateEvaluationChecklistItemDto's fields and validation decorators (label, section, order), makes them optional for PATCH.
// isChecked is added manually below: PartialType only knows about fields that already exist in the create DTO.
export class UpdateEvaluationChecklistItemDto extends PartialType(
  CreateEvaluationChecklistItemDto
) {
  @IsOptional()
  @IsBoolean()
  isChecked?: boolean;
}
