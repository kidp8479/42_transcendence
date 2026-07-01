// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// status is not here: it is never set manually - the backend calculates it automatically
// based on checklist progress or note completion TBD (NOT_STARTED => IN_PROGRESS => COMPLETED)

export class CreateDiscoveryBlockDto {
  projectId: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  notes?: string;
}
