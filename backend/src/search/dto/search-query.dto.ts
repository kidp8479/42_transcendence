// The exception to the rule every other DTO in this repo states in its header:
// this one validates a QUERY STRING, not a body. GET /api/search takes all its
// input from the URL, and those params need validating exactly as much as a
// POST body would - more, even, since a query string is trivially hand-edited.
//
// Two consequences of main.ts's global ValidationPipe drive everything below:
//   - forbidNonWhitelisted: true -> any query key NOT declared here is a 400.
//     The frontend must therefore send exactly these keys and nothing more, so
//     it cannot forward the page's own URL (which also carries UI-only state).
//   - enableImplicitConversion is NOT set -> every param arrives as a string.
//     Numbers and booleans have to be converted explicitly, see @Type/@Transform.

import { ProjectStatus, TaskStatus } from "@prisma/client";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
// Package root, not a deep path into class-transformer/types/*: that directory
// ships only .d.ts files, so a deep import typechecks and then throws
// MODULE_NOT_FOUND at boot (same note as create-task.dto.ts).
import { Transform, Type } from "class-transformer";

import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
  SEARCH_MAX_LIMIT,
} from "../search.constants";

// Declared as `as const` tuples so the runtime list @IsIn checks and the
// compile-time union the service switches on come from ONE source. Writing the
// values twice - once in the decorator, once in a hand-written union - is how
// the two silently drift apart.
export const SEARCH_TYPES = ["all", "projects", "tasks", "users"] as const;
export const SEARCH_SORTS = ["name", "recent"] as const;
export const SEARCH_ORDERS = ["asc", "desc"] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchSort = (typeof SEARCH_SORTS)[number];
export type SearchOrder = (typeof SEARCH_ORDERS)[number];

// The two status enums overlap on IN_PROGRESS/REVIEW/COMPLETED, so the naive
// concatenation lists those three twice - and class-validator prints the raw
// array back to the client, giving a 400 message that reads like a bug. The Set
// collapses them without changing what is accepted.
const SEARCH_STATUSES = [
  ...new Set([...Object.values(ProjectStatus), ...Object.values(TaskStatus)]),
];

// Every optional field is left undefined rather than given a default here:
// SearchService resolves the defaults once, at the top of its search(), and
// echoes the resolved values back in the response. One place to read them.
export class SearchQueryDto {
  // Trimmed before validating, so a query of three spaces fails @MinLength as
  // the empty search it really is, instead of running a full scan for "   ".
  // Same pattern as AddMemberDto.username.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(SEARCH_QUERY_MIN_LENGTH)
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  q: string;

  @IsOptional()
  @IsIn(SEARCH_TYPES)
  type?: SearchType;

  @IsOptional()
  @IsIn(SEARCH_SORTS)
  sort?: SearchSort;

  @IsOptional()
  @IsIn(SEARCH_ORDERS)
  order?: SearchOrder;

  // @Type is not decoration here, it is what makes the field work at all:
  // without it "2" reaches @IsInt as a string and every ?page=... is a 400.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // Capped at SEARCH_MAX_LIMIT so a caller can't ask for the whole table in a
  // single page - this cap IS the pagination, without it there is none.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SEARCH_MAX_LIMIT)
  limit?: number;

  // @IsIn rather than the @IsEnum the other DTOs use, because this one field
  // accepts values from TWO enums depending on the active `type`. The union is
  // deliberately permissive: the service applies the value only to the type it
  // belongs to (isProjectStatus / isTaskStatus) and ignores it when type=all,
  // so a TaskStatus can never end up filtering projects.
  @IsOptional()
  @IsIn(SEARCH_STATUSES)
  status?: ProjectStatus | TaskStatus;

  // Destructure the params object: @Transform receives { value, key, obj, ... },
  // never the bare value - comparing the parameter itself to "true" is always
  // false, and the flag would silently never turn on.
  // The string test is the load-bearing half: a query string carries "true",
  // not true, and @IsBoolean rejects that string before it can mean anything.
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}
