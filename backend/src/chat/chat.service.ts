// ChatService: handles all database operations for ChatMessages
// called by the controller, never called directly by the frontend

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
  // Opening a conversation (loading its history) is what counts as "read"
  // for the unread badge - see markRead below.
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

    // only the first page (no cursor) reflects "caught up to the latest
    // message" - paging further back into history shouldn't move the read
    // marker forward past messages the caller hasn't actually seen yet.
    if (query.before === undefined) {
      await this.markRead(projectId, userId);
    }

    return messages.reverse();
  }

  // GET /chat/unread - project ids (among this user's own memberships) that
  // have at least one message, from someone else, newer than this user's
  // own ChatReadState.lastReadAt (or no ChatReadState row at all yet, i.e.
  // never opened). Drives the red-dot badge on the Chat nav item and on
  // each conversation row - no unread count, just a boolean per project.
  async findUnreadProjectIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = memberships.map((membership) => membership.projectId);
    if (projectIds.length === 0) {
      return [];
    }

    const [readStates, latestMessagesFromOthers] = await Promise.all([
      this.prisma.chatReadState.findMany({
        where: { userId, projectId: { in: projectIds } },
        select: { projectId: true, lastReadAt: true },
      }),
      this.prisma.chatMessage.groupBy({
        by: ["projectId"],
        where: { projectId: { in: projectIds }, userId: { not: userId } },
        _max: { createdAt: true },
      }),
    ]);
    const lastReadAtByProject = new Map(
      readStates.map((state) => [state.projectId, state.lastReadAt])
    );

    return latestMessagesFromOthers
      .filter(({ projectId, _max }) => {
        if (_max.createdAt === null) {
          return false;
        }
        const lastReadAt = lastReadAtByProject.get(projectId);
        return lastReadAt === undefined || _max.createdAt > lastReadAt;
      })
      .map(({ projectId }) => projectId);
  }

  private async markRead(projectId: string, userId: string): Promise<void> {
    await this.prisma.chatReadState.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId },
      update: { lastReadAt: new Date() },
    });
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

    this.realtimeService.emitToProject(projectId, "chat:created", message);
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
      include: { user: { select: AUTHOR_SELECT } },
    });
    // full message, not just {id}: the frontend's generic live-sync hook
    // (useLiveItemSync) validates every event's payload against the same
    // parser as create/findAll and reads projectId off it to scope updates
    // to the conversation currently open - a bare {id} wouldn't parse.
    this.realtimeService.emitToProject(
      projectId,
      "chat:deleted",
      deletedMessage
    );
    return deletedMessage;
  }
}
