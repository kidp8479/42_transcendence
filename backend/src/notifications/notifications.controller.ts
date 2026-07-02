// NotificationsController: handles all HTTP requests under /api/notifications
// one method per route - delegates all database work to NotificationsService
// note: there is no POST route here - notifications are created internally by other
// services (ex: TasksService, ProjectMembersService) calling NotificationsService.create()
// directly in code, never by the frontend sending a request body.

import { Controller } from "@nestjs/common";

@Controller("notifications")
export class NotificationsController {
  // TODO: inject NotificationsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // GET    /api/notifications
  //        => get all notifications for a given user
  //        => expects ?userId=... as a URL query param (no request body, no DTO)
  // PATCH  /api/notifications/:id/read
  //        => mark a notification as read
  //        => no request body needed: isRead only ever goes false => true, the URL says it all (no DTO)
  // DELETE /api/notifications/:id
  //        => delete a notification by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
