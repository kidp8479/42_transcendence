// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// isChecked is not here: it is always false at creation, handled by @default(false) in the database schema.

export class CreateDiscoveryBlockItemDto {
  discoveryBlockId: string;
  label: string;
}
