// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// discoveryBlockId is not here: it comes from the URL (/discovery-blocks/:discoveryBlockId/items), not the request body.
// isChecked is not here: it is always false at creation, handled by @default(false) in the database schema.
// order: the frontend sends the initial position of the item in the list (0-based index).

import { IsInt, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export const DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH = 200;

export class CreateDiscoveryBlockItemDto {
  // trims before MinLength runs, so a whitespace-only label (ex: " ") can't
  // pass validation as if it were real content - the frontend already trims
  // before submitting, this is the same guarantee enforced server-side
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH)
  label: string;

  @IsInt()
  order: number;
}
