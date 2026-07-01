// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move an item from one project to another.
// isChecked is not in the create DTO (always false at creation) but lives here, it's the main use case.
// order is updated here when the user drags and drops to reorder items.

export class UpdateEvaluationChecklistItemDto {
  label?: string;
  section?: string;
  isChecked?: boolean;
  order?: number;
}
