// All fields are optional - the caller can update only one field at a time.
// discoveryBlockId is not here: you never move an item from one block to another (and it never was in the create DTO either).
// isChecked is the main use case - checking or unchecking an item. Not in the create DTO, so added here manually.
// order is updated here when the user drags and drops to reorder items.

import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateDiscoveryBlockItemDto } from "./create-discovery-block-item.dto";

// Reuses CreateDiscoveryBlockItemDto's fields and validation decorators (label, order), makes them optional for PATCH.
// isChecked is added manually below: PartialType only knows about fields that already exist in the create DTO.
export class UpdateDiscoveryBlockItemDto extends PartialType(
  CreateDiscoveryBlockItemDto
) {
  @IsOptional()
  @IsBoolean()
  isChecked?: boolean;
}
