// ChatService: handles all database operations for ChatMessages
// called by the controller, never called directly by the frontend

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { ProjectsService } from "../projects/projects.service";
import { CreateChatMessageDto } from "./dto/create-chat-message.dto";
import { FindChatMessagesDto } from "./dto/find-chat-messages.dto";
import { CHAT_MESSAGES_DEFAULT_PAGE_SIZE } from "./chat.constants";

// author is not the User's full row - only what a chat bubble needs to
// render (see MockMember in frontend's chat.tsx), same shape as
// ProjectMembersService's member.user select.
const AUTHOR_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} as const;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly realtimeService: RealtimeService
  ) {}

  // GET (page of history) - cursor pagination, newest page by default, or
  // the page strictly older than query.before (infinite scroll upward).
  // Returned oldest-first, the order a chat thread renders top-to-bottom.
  async findAll(projectId: string, userId: string, query: FindChatMessagesDto) {
    await this.projectsService.assertMembership(projectId, userId);

    const take = query.take ?? CHAT_MESSAGES_DEFAULT_PAGE_SIZE;
    const messages = await this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take,
      ...(query.before !== undefined
        ? { skip: 1, cursor: { id: query.before } }
        : {}),
      include: { user: { select: AUTHOR_SELECT } },
    });

    return messages.reverse();
  }

  // POST - persists the message, then broadcasts it so every other member
  // currently connected sees it without a refetch (write before diffuse,
  // never the other way, otherwise a broadcast message with a failed write
  // behind it would be lost on reload).
  async create(projectId: string, userId: string, dto: CreateChatMessageDto) {
    await this.projectsService.assertMembership(projectId, userId);

    const message = await this.prisma.chatMessage.create({
      data: {
        content: dto.content,
        project: { connect: { id: projectId } },
        user: { connect: { id: userId } },
      },
      include: { user: { select: AUTHOR_SELECT } },
    });

    this.realtimeService.emitToProject(projectId, "chat:message", message);
    return message;
  }

  // DELETE - only the author can delete their own message.
  async remove(projectId: string, id: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);

    const message = await this.prisma.chatMessage.findFirst({
      where: { id, projectId },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    if (message.userId !== userId) {
      throw new ForbiddenException("You can only delete your own messages");
    }

    const deletedMessage = await this.prisma.chatMessage.delete({
      where: { id },
    });
    this.realtimeService.emitToProject(projectId, "chat:message:deleted", {
      id: deletedMessage.id,
    });
    return deletedMessage;
  }
}
