// Query params for GET /projects/:projectId/chat - cursor pagination over
// history, newest page first. "before" is a ChatMessage id: when given, the
// service loads the page of messages strictly older than that message
// (infinite scroll upward). Omitted on first load, which returns the most
// recent CHAT_MESSAGES_DEFAULT_PAGE_SIZE messages.

import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { CHAT_MESSAGES_MAX_PAGE_SIZE } from "../chat.constants";

export class FindChatMessagesDto {
  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CHAT_MESSAGES_MAX_PAGE_SIZE)
  take?: number;
}
