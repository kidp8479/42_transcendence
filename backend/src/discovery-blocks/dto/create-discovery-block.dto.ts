// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/discovery-blocks), not the request body.
// status is not here: it is never set manually - the backend calculates it automatically
// based on checklist progress or note completion TBD (NOT_STARTED => IN_PROGRESS => COMPLETED)

import { IsOptional, IsString } from "class-validator";

export class CreateDiscoveryBlockDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString() // no fixed icon set yet - revisit with @IsIn([...]) if an icon library gets chosen
  icon?: string;

  @IsOptional()
  @IsString() // no fixed color palette yet - revisit with @IsHexColor() or @IsIn([...]) once decided
  color?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
