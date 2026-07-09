// NotificationsController: handles all HTTP requests under /api/notifications
// one method per route - delegates all database work to NotificationsService
// note: there is no POST route here - notifications are created internally by other
// services (ex: TasksService, ProjectMembersService) calling NotificationsService.create()
// directly in code, never by the frontend sending a request body.
// note: when implementing, validate :id with @Param('id', ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database
// note: never trust a client-supplied userId (body, URL, or query param) to decide
// whose notifications to read/modify/delete - always derive it from req.user.id,
// set by the auth guard once a request is authenticated. Otherwise any caller can
// read/mark-read/delete another user's notifications just by changing an id (IDOR).

import { Controller } from "@nestjs/common";

@Controller("notifications")
export class NotificationsController {
  // TODO: inject NotificationsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // GET    /api/notifications
  //        => get all notifications belonging to the authenticated user
  //        => userId comes from req.user.id (auth guard), never from a query param
  // PATCH  /api/notifications/:id/read
  //        => mark a notification as read
  //        => must verify the notification belongs to req.user.id before updating it
  //        => no request body needed: isRead only ever goes false => true, the URL says it all (no DTO)
  // DELETE /api/notifications/:id
  //        => delete a notification by its id
  //        => must verify the notification belongs to req.user.id before deleting it
  //        => no request body needed, the id in the URL is enough (no DTO)
}
