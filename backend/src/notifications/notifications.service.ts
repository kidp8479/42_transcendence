// NotificationsService: handles all database operations for Notifications
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class NotificationsService {
  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(userId: string, message: string, link?: string)
  //       => insert a new notification in the database
  //       => called internally by other services (ex: TasksService, ProjectMembersService)
  //          when something happens that the user should be told about - never called from
  //          the controller, since there is no public POST route for notifications
  // TODO: findAllByUser(userId: string)
  //       => fetch all notifications belonging to a given user
  // TODO: markAsRead(id: string, userId: string)
  //       => set isRead to true on a notification
  //       => must throw (ex: NotFoundException) if the notification's userId !== userId,
  //          so ownership is enforced here, not just trusted from the controller
  // TODO: remove(id: string, userId: string)
  //       => permanently delete a notification
  //       => must throw (ex: NotFoundException) if the notification's userId !== userId,
  //          same ownership check as markAsRead
}
