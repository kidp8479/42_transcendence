// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/discovery-blocks), not the request body.
// status is not here: it is never set manually - DiscoveryBlocksService.recalculateStatus()
// derives it from checklist progress after every item create/update/remove

import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export const DISCOVERY_BLOCK_TITLE_MAX_LENGTH = 100;
export const DISCOVERY_BLOCK_DESCRIPTION_MAX_LENGTH = 500;
export const DISCOVERY_BLOCK_NOTES_MAX_LENGTH = 2000;

export const DISCOVERY_BLOCK_ICON_NAMES = [
  "search",
  "layers",
  "palette",
  "link",
  "notebook",
  "wheel",
] as const;

export const DISCOVERY_BLOCK_COLOR_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export class CreateDiscoveryBlockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(DISCOVERY_BLOCK_TITLE_MAX_LENGTH)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(DISCOVERY_BLOCK_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsIn(DISCOVERY_BLOCK_ICON_NAMES)
  icon?: string;

  @IsOptional()
  @IsInt()
  @IsIn(DISCOVERY_BLOCK_COLOR_INDICES)
  color?: number;

  @IsOptional()
  @IsString()
  @MaxLength(DISCOVERY_BLOCK_NOTES_MAX_LENGTH)
  notes?: string;
}
