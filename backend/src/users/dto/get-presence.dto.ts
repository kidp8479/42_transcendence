// Validates GET /users/presence?ids=... - a query string, not a body, see
// search.dto.ts's own header for why that still goes through class-validator.
// ids arrives as one comma-separated string (no repeated-key array syntax),
// split by hand since class-transformer has no built-in for that shape.

import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsUUID,
} from "class-validator";
import { Transform } from "class-transformer";

// Matches the accepted-friends list this is polled for - comfortably above
// any real friend list size, just enough to stop an arbitrarily large query
// string from turning into an arbitrarily large IN (...) clause.
const PRESENCE_MAX_IDS = 200;

export class GetPresenceQueryDto {
  @Transform(({ value }) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : value
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(PRESENCE_MAX_IDS)
  @IsUUID("4", { each: true })
  ids: string[];
}
