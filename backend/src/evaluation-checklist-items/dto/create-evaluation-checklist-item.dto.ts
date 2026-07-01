// A DTO (Data Transfer Object) is just a description of the shape of the data you expect to receive.
// It's a simple object that says "when someone sends me data, it must look like this.
// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// isChecked is not here: it is always false at creation, handled by @default(false) in the database schema.

export class CreateEvaluationChecklistItemDto {
  projectId: string;
  label: string;
  section: string;
}
