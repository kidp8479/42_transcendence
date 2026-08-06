// ChatController: handles all HTTP requests under /api/projects/:projectId/chat
// one method per route - delegates all database work to ChatService
// note: projectId always comes from the URL, never from the request body
// note: :projectId alone does not prove access - every route calls
// assertMembership (via the service) before returning/changing anything,
// otherwise any authenticated user could read or post to any project's chat
// just by changing the projectId in the URL (IDOR).

import {
  Controller,
  Get,
  Delete,
  Patch,
  Post,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { ChatService } from "./chat.service";
import { CreateChatMessageDto } from "./dto/create-chat-message.dto";
import { FindChatMessagesDto } from "./dto/find-chat-messages.dto";
import { MarkChatReadDto } from "./dto/mark-chat-read.dto";

@Controller("projects/:projectId/chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // GET - a page of message history, newest page by default, or the page
  // strictly older than ?before=<messageId> (infinite scroll upward).
  @Get()
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() query: FindChatMessagesDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.chatService.findAll(projectId, request.user.id, query);
  }

  // POST - persists a new message and broadcasts it on "chat:created" to
  // project:<projectId>. Real-time delivery of new messages is this route,
  // not the websocket - the websocket only carries what this call already
  // wrote to the database.
  @ApiBearerAuth("access-token")
  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateChatMessageDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.chatService.create(projectId, request.user.id, dto);
  }

  // PATCH (mark this conversation read up to the newest message the caller
  // actually fetched - see MarkChatReadDto for why the body carries that
  // instead of the server just stamping its own "now"). Called explicitly
  // by the frontend once it has applied a fetched page to its own state,
  // not triggered implicitly by the GET above.
  @ApiBearerAuth("access-token")
  @Patch("read")
  markRead(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: MarkChatReadDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.chatService.markRead(projectId, request.user.id, dto);
  }

  // DELETE - only the message's own author can delete it.
  @ApiBearerAuth("access-token")
  @Delete(":id")
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.chatService.remove(projectId, id, request.user.id);
  }
}

// Separate controller (unscoped by :projectId, unlike ChatController above)
// for the one chat route that spans every project the caller belongs to at
// once - drives the red-dot unread badge on the Chat nav item and on each
// conversation row.
@Controller("chat")
export class ChatUnreadController {
  constructor(private readonly chatService: ChatService) {}

  @Get("unread")
  findUnread(@Req() request: AuthenticatedRequest) {
    return this.chatService.findUnreadProjectIds(request.user.id);
  }
}
