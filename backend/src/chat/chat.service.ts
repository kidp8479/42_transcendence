// ChatService: handles all database operations for ChatMessages
// called by the controller, never called directly by the frontend

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { ProjectsService } from "../projects/projects.service";
import { CreateChatMessageDto } from "./dto/create-chat-message.dto";
import { FindChatMessagesDto } from "./dto/find-chat-messages.dto";
import { MarkChatReadDto } from "./dto/mark-chat-read.dto";
import { CHAT_MESSAGES_DEFAULT_PAGE_SIZE } from "./chat.constants";
import { isRecordNotFoundError } from "../common/is-record-not-found-error";

// author is not the User's full row - only what a chat bubble needs to
// render (see ChatMessageAuthor in frontend's chatApi.ts): a subset of
// ProjectMembersService's own member.user select, which also pulls campus
// (shown elsewhere in member lists) - chat bubbles have no use for it.
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
  // the page strictly older than (query.beforeCreatedAt, query.before)
  // (infinite scroll upward). Filtered on beforeCreatedAt/before as plain
  // where-clause values rather than passed to Prisma's `cursor` option, so a
  // page still loads correctly even if the message the caller is paging up
  // from has since been deleted - a `cursor` row that no longer exists makes
  // findMany silently return an empty page instead of erroring, which read
  // as "no more history" client-side. Returned oldest-first, the order a
  // chat thread renders top-to-bottom. Marking the conversation read is a
  // separate explicit action - see markRead below - not a side effect of
  // this GET.
  async findAll(projectId: string, userId: string, query: FindChatMessagesDto) {
    await this.projectsService.assertMembership(projectId, userId);

    const take = query.take ?? CHAT_MESSAGES_DEFAULT_PAGE_SIZE;
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        projectId,
        ...(query.beforeCreatedAt !== undefined && query.before !== undefined
          ? {
              OR: [
                { createdAt: { lt: new Date(query.beforeCreatedAt) } },
                {
                  createdAt: new Date(query.beforeCreatedAt),
                  id: { lt: query.before },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      include: { user: { select: AUTHOR_SELECT } },
    });

    return messages.reverse();
  }

  // GET /chat/unread - project ids (among this user's own memberships) that
  // have at least one message, from someone else, strictly newer than this
  // user's own ChatReadState watermark (or no ChatReadState row at all yet,
  // i.e. never opened). Drives the red-dot badge on the Chat nav item and on
  // each conversation row - no unread count, just a boolean per project.
  //
  // "newer than" is a compound (createdAt, lastReadMessageId) comparison,
  // not a plain createdAt one: two messages can share the same millisecond
  // timestamp, and a timestamp-only comparison can't tell an unobserved one
  // from the one the watermark actually points to - same (createdAt, id)
  // tiebreak as findAll's own cursor pagination above, for the same reason.
  async findUnreadProjectIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = memberships.map((membership) => membership.projectId);
    if (projectIds.length === 0) {
      return [];
    }

    const readStates = await this.prisma.chatReadState.findMany({
      where: { userId, projectId: { in: projectIds } },
      select: { projectId: true, lastReadAt: true, lastReadMessageId: true },
    });
    const readStateByProject = new Map(
      readStates.map((state) => [state.projectId, state])
    );

    // one OR branch per project: no read state yet => any message from
    // someone else is unread; otherwise strictly after the watermark in
    // (createdAt, id) order. lastReadMessageId is only null for a
    // conversation that had zero messages when it was marked read (see
    // markRead below) - createdAt alone is the best we can do there, the
    // same-millisecond edge case doesn't apply since nothing existed yet.
    const unreadConditions = projectIds.map((projectId) => {
      const readState = readStateByProject.get(projectId);
      if (readState === undefined) {
        return { projectId };
      }
      return {
        projectId,
        OR: [
          { createdAt: { gt: readState.lastReadAt } },
          ...(readState.lastReadMessageId !== null
            ? [
                {
                  createdAt: readState.lastReadAt,
                  id: { gt: readState.lastReadMessageId },
                },
              ]
            : []),
        ],
      };
    });

    const unreadProjects = await this.prisma.chatMessage.findMany({
      where: {
        AND: [
          { OR: [{ userId: { not: userId } }, { userId: null }] },
          { OR: unreadConditions },
        ],
      },
      distinct: ["projectId"],
      select: { projectId: true },
    });

    return unreadProjects.map((message) => message.projectId);
  }

  // PATCH /chat/read - explicit "mark this conversation read" action, called
  // by the frontend once it has actually applied a freshly-fetched page to
  // its own state (never as a side effect of the GET itself - see findAll
  // above). Mirrors notifications' PATCH read-all rather than inventing a
  // new pattern.
  //
  // The watermark is the newest message the caller actually fetched (dto),
  // never the server's own wall-clock "now": a message from someone else
  // can be inserted in the gap between the caller's history GET and this
  // PATCH, and "now" would land after that insert, wrongly marking a
  // message the caller never rendered as read. dto is empty when the
  // conversation had zero messages to observe - nothing to record, and the
  // existing "no row => unread" default below handles the first message
  // that eventually arrives correctly on its own.
  async markRead(
    projectId: string,
    userId: string,
    dto: MarkChatReadDto
  ): Promise<void> {
    await this.projectsService.assertMembership(projectId, userId);
    if (dto.lastReadAt === undefined || dto.lastReadMessageId === undefined) {
      return;
    }

    const lastReadAt = new Date(dto.lastReadAt);
    const readState = await this.prisma.chatReadState.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: {
        userId,
        projectId,
        lastReadAt,
        lastReadMessageId: dto.lastReadMessageId,
      },
      update: { lastReadAt, lastReadMessageId: dto.lastReadMessageId },
    });
    // same reasoning as NotificationsService.markAsRead's own
    // emitToUser("notification:read", ...) - without this, a user's other
    // open tabs/devices never learn this conversation was read anywhere
    // else and keep showing its unread dot until their own background
    // /chat/unread refetch happens to catch up.
    this.realtimeService.emitToUser(userId, "chat:read", {
      projectId,
      lastReadAt: readState.lastReadAt,
      lastReadMessageId: readState.lastReadMessageId,
    });
  }

  // POST - persists the message, then broadcasts it so every other member
  // currently connected sees it without a refetch (write before diffuse,
  // never the other way, otherwise a broadcast message with a failed write
  // behind it would be lost on reload).
  //
  // assertMembership + the write both run inside RealtimeService's
  // withProjectFieldLock, which takes the project's shared lock - this is
  // an existing primitive (see realtime.service.ts), not something added
  // for chat. removeMember/updateMemberRole (project-members.service.ts)
  // take that same project's *exclusive* lock around their own membership
  // row changes, so as long as this authorize-then-write pair holds the
  // shared lock too, a removal can never complete in the window between the
  // check and the insert - without this, assertMembership passing was no
  // guarantee by the time the create actually ran. The key is a fresh id
  // per call (not a fixed `chat:${projectId}`) so one create doesn't wait on
  // another unrelated create in the same project to finish - only the
  // shared/exclusive project boundary needs to be respected here, not a
  // per-resource queue.
  async create(projectId: string, userId: string, dto: CreateChatMessageDto) {
    return this.realtimeService.withProjectFieldLock(
      projectId,
      `chat-message:create:${randomUUID()}`,
      async () => {
        await this.projectsService.assertMembership(projectId, userId);

        let message;
        try {
          message = await this.prisma.chatMessage.create({
            data: {
              content: dto.content,
              project: { connect: { id: projectId } },
              user: { connect: { id: userId } },
            },
            include: { user: { select: AUTHOR_SELECT } },
          });
        } catch (error) {
          // assertMembership passing above doesn't guarantee the user still
          // exists by the time this write runs - a narrow race where the
          // account is deleted (User row gone, cascading its ProjectMember)
          // between the two calls makes `user: { connect }` fail with P2025.
          // An expired-but-not-yet-revoked token hitting that race deserves
          // a 403, not Prisma's raw "record to connect not found" surfaced
          // as an unrelated 404.
          if (isRecordNotFoundError(error)) {
            throw new ForbiddenException("Your account no longer exists");
          }
          throw error;
        }

        this.realtimeService.emitToProject(projectId, "chat:created", message);
        return message;
      }
    );
  }

  // DELETE - only the author can delete their own message. Same
  // shared-project-lock reasoning as create above, keyed by the message id
  // since a delete does act on one specific pre-existing row.
  async remove(projectId: string, id: string, userId: string) {
    return this.realtimeService.withProjectFieldLock(
      projectId,
      `chat-message:${id}`,
      async () => {
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
        // full message, not just {id}: the frontend's generic live-sync
        // hook (useLiveItemSync) validates every event's payload against
        // the same parser as create/findAll and reads projectId off it to
        // scope updates to the conversation currently open - a bare {id}
        // wouldn't parse.
        this.realtimeService.emitToProject(
          projectId,
          "chat:deleted",
          deletedMessage
        );
        return deletedMessage;
      }
    );
  }
}
