// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move a block from one project to another.

// status is not here: it is never set manually - the backend calculates it automatically
// based on checklist progress or note completion TBD (NOT_STARTED => IN_PROGRESS => COMPLETED)

export class UpdateDiscoveryBlockDto {
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
  notes?: string;
}
