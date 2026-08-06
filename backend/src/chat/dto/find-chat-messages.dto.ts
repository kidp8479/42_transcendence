// Query params for GET /projects/:projectId/chat - cursor pagination over
// history, newest page first. "before"/"beforeCreatedAt" identify the last
// message the caller already has (infinite scroll upward): the service
// filters on beforeCreatedAt (tie-broken by before, the id) instead of using
// that message as a Prisma `cursor` row, so the query still works even if
// that exact message has since been deleted - the caller already holds both
// values locally from the message it's paging up from, no DB lookup of the
// cursor row needed. Both must be sent together. Omitted on first load,
// which returns the most recent CHAT_MESSAGES_DEFAULT_PAGE_SIZE messages.

import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import { CHAT_MESSAGES_MAX_PAGE_SIZE } from "../chat.constants";

export class FindChatMessagesDto {
  @ValidateIf((dto) => dto.beforeCreatedAt !== undefined)
  @IsUUID()
  before?: string;

  @ValidateIf((dto) => dto.before !== undefined)
  @IsDateString()
  beforeCreatedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CHAT_MESSAGES_MAX_PAGE_SIZE)
  take?: number;
}
