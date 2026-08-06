// Body for PATCH /projects/:projectId/chat/read - the id and createdAt of
// the newest message the caller actually fetched and rendered. Sent by the
// frontend instead of letting the backend stamp its own wall-clock "now":
// a message from someone else can be inserted between the caller's history
// GET and this PATCH, and "now" would be after that insert, incorrectly
// marking a message the caller never saw as read. Both omitted when the
// conversation had zero messages to observe (see ChatService.markRead).
import { IsDateString, IsUUID, ValidateIf } from "class-validator";

export class MarkChatReadDto {
  @ValidateIf((dto) => dto.lastReadAt !== undefined)
  @IsUUID()
  lastReadMessageId?: string;

  @ValidateIf((dto) => dto.lastReadMessageId !== undefined)
  @IsDateString()
  lastReadAt?: string;
}
