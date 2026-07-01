// NotificationsController: handles all HTTP requests under /api/notifications
// one method per route - delegates all database work to NotificationsService

import { Controller } from "@nestjs/common";

@Controller("notifications")
export class NotificationsController {
  // TODO: inject NotificationsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/notifications
  //        => create a new notification
  //        => expects a request body matching CreateNotificationDto (userId, message)
  // GET    /api/notifications
  //        => get all notifications for a given user
  //        => expects ?userId=... as a URL query param (no request body, no DTO)
  // PATCH  /api/notifications/:id
  //        => mark a notification as read
  //        => expects a request body matching UpdateNotificationDto (isRead)
  // DELETE /api/notifications/:id
  //        => delete a notification by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
