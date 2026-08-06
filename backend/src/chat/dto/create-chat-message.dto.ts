// projectId is not here: it comes from the URL (/projects/:projectId/chat), not the request body.
// authorId is not here: it's always the authenticated user (req.user.id), never client-supplied.

import { IsString, MinLength, MaxLength } from "class-validator";
import { Transform } from "class-transformer";
import { CHAT_MESSAGE_CONTENT_MAX_LENGTH } from "../chat.constants";

export class CreateChatMessageDto {
  // Trims before MinLength runs, so whitespace-only messages can't pass validation.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(CHAT_MESSAGE_CONTENT_MAX_LENGTH)
  content: string;
}
