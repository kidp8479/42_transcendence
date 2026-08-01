// NotificationsService: handles all database operations for Notifications
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { isRecordNotFoundError } from "../common/is-record-not-found-error";

@Injectable()
export class NotificationsService {
  prisma: PrismaService;
  realtimeService: RealtimeService;
  constructor(prisma: PrismaService, realtimeService: RealtimeService) {
    this.prisma = prisma;
    this.realtimeService = realtimeService;
  }

  // called internally by other services (ex: TasksService, ProjectMembersService)
  // when something happens that the user should be told about - never called
  // from the controller, since there is no public POST route for notifications
  //
  // after inserting the row, pushes it straight to that user's browser over
  // WebSocket (personal room "user:{userId}", see RealtimeGateway) - the first
  // real end-to-end use of the whole realtime layer built so far
  async create(userId: string, message: string, link?: string) {
    const notification = await this.prisma.notification.create({
      data: { userId: userId, message: message, link: link },
    });

    this.realtimeService.emitToUser(userId, "notification:new", notification);

    return notification;
  }

  // fetches every notification belonging to a given user - most recent first,
  // so the newest notifications show up on top in the frontend bell/list
  async findAllByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: "desc" },
    });
  }

  // shared by markAsRead/remove below: find the notification scoped to
  // this exact userId - if it doesn't come back, either it doesn't exist
  // or it belongs to someone else, and either way the right response is
  // the same 404 (never leak which case it was)
  private async findOwnedOrThrow(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: id, userId: userId },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }
    return notification;
  }

  async markAsRead(id: string, userId: string) {
    await this.findOwnedOrThrow(id, userId);

    let updated;
    try {
      updated = await this.prisma.notification.update({
        where: { id: id },
        data: { isRead: true },
      });
    } catch (error) {
      // someone else (or another tab) deleted this notification in the race
      // window between the guard above and this update - a clean 404
      // instead of Prisma's raw "record to update not found" text leaking
      // to the client
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException("Notification not found");
      }
      throw error;
    }
    // so every other tab this user has open (a mark-as-read in tab A should
    // be reflected in tab B without waiting for a reload) stays in sync -
    // the acting tab already applied this locally, so receiving its own
    // echo back is a harmless no-op update by id
    this.realtimeService.emitToUser(userId, "notification:read", updated);
    return updated;
  }

  // marks every unread notification belonging to this user as read in one
  // query - no per-row ownership check needed like markAsRead/remove, the
  // where clause itself already scopes everything to userId
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true },
    });
    this.realtimeService.emitToUser(userId, "notification:read-all", {});
    return result;
  }

  async remove(id: string, userId: string) {
    const existingNotification = await this.findOwnedOrThrow(id, userId);

    // two deletes racing on the same notification (double-click, or a
    // client-side "mark as read" auto-deleting while the user also hits
    // delete) both want it gone - the second one isn't really a failure,
    // same reasoning as the delete-race fix elsewhere in this PR
    let deleted;
    try {
      deleted = await this.prisma.notification.delete({
        where: { id: id },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        deleted = existingNotification;
      } else {
        throw error;
      }
    }
    this.realtimeService.emitToUser(userId, "notification:deleted", {
      id: deleted.id,
    });
    return deleted;
  }

  // deletes every notification belonging to this user, read or unread -
  // same deleteMany/no-ownership-check-needed reasoning as markAllAsRead
  async removeAll(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId: userId },
    });
    this.realtimeService.emitToUser(userId, "notification:deleted-all", {});
    return result;
  }
}
