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
  // TODO: create(dto: CreateNotificationDto)
  //       => insert a new notification in the database
  // TODO: findAllByUser(userId: string)
  //       => fetch all notifications belonging to a given user
  // TODO: markAsRead(id: string)
  //       => set isRead to true on a notification
  // TODO: remove(id: string)
  //       => permanently delete a notification
}
