// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/discovery-blocks), not the request body.
// status is not here: it is never set manually - the backend calculates it automatically
// based on checklist progress or note completion TBD (NOT_STARTED => IN_PROGRESS => COMPLETED)

import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateDiscoveryBlockDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString() // no fixed icon set yet - revisit with @IsIn([...]) if an icon library gets chosen
  icon?: string;

  // same representation as TaskCategory.color/CalendarCategory.color: an index into
  // a fixed palette defined on the frontend (not decided yet - revisit with
  // @IsIn([...]) once the palette's size is fixed)
  @IsOptional()
  @IsInt()
  color?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
