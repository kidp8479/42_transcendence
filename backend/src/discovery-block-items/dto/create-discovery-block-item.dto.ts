// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// discoveryBlockId is not here: it comes from the URL (/discovery-blocks/:discoveryBlockId/items), not the request body.
// isChecked is not here: it is always false at creation, handled by @default(false) in the database schema.
// order: the frontend sends the initial position of the item in the list (0-based index).

import { IsInt, IsString, MaxLength, MinLength } from "class-validator";

// same named-constant point as create-discovery-block.dto.ts - mirrored by
// the frontend edit screen's own maxLength attribute on the "New item..." input.
export const DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH = 200;

export class CreateDiscoveryBlockItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH)
  label: string;

  @IsInt()
  order: number;
}
