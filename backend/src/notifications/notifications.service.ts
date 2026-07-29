// NotificationsService: handles all database operations for Notifications
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";

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
  // real end-to-end use of the whole realtime layer built in bricks 1-4
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

  // ownership check happens here, not just trusted from the controller:
  // find the notification scoped to this exact userId - if it doesn't come
  // back, either it doesn't exist or it belongs to someone else, and either
  // way the right response is the same 404 (never leak which case it was)
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: id, userId: userId },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return this.prisma.notification.update({
      where: { id: id },
      data: { isRead: true },
    });
  }

  // same ownership check as markAsRead, then a permanent delete
  async remove(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: id, userId: userId },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return this.prisma.notification.delete({
      where: { id: id },
    });
  }
}
