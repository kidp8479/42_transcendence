// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move a block from one project to another (and it never was in the create DTO either).
// status is not here: it is never set manually - the backend calculates it automatically
// based on checklist progress or note completion TBD (NOT_STARTED => IN_PROGRESS => COMPLETED)

import { PartialType } from "@nestjs/mapped-types";
import { CreateDiscoveryBlockDto } from "./create-discovery-block.dto";

// Reuses CreateDiscoveryBlockDto's fields and validation decorators, makes them all optional for PATCH.
export class UpdateDiscoveryBlockDto extends PartialType(
  CreateDiscoveryBlockDto
) {}
