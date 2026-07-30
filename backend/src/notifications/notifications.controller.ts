// NotificationsController: handles all HTTP requests under /api/notifications
// one method per route - delegates all database work to NotificationsService
// note: there is no POST route here - notifications are created internally by other
// services (ex: TasksService, ProjectMembersService) calling NotificationsService.create()
// directly in code, never by the frontend sending a request body.
// note: never trust a client-supplied userId (body, URL, or query param) to decide
// whose notifications to read/modify/delete - always derive it from req.user.id,
// set by the auth guard once a request is authenticated. Otherwise any caller can
// read/mark-read/delete another user's notifications just by changing an id (IDOR).

import {
  Controller,
  Get,
  Patch,
  Delete,
  Req,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  notificationsService: NotificationsService;
  constructor(notificationsService: NotificationsService) {
    this.notificationsService = notificationsService;
  }

  // GET (all, belonging to the authenticated user)
  @Get()
  findAllByUser(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.findAllByUser(request.user.id);
  }

  // PATCH (mark every unread notification as read - no request body, no id:
  // it always applies to the whole authenticated user's set)
  @ApiSecurity("csrf")
  @Patch("read-all")
  markAllAsRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(request.user.id);
  }

  // PATCH (mark as read - no request body, the URL says it all)
  @ApiSecurity("csrf")
  @Patch(":id/read")
  markAsRead(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.notificationsService.markAsRead(id, request.user.id);
  }

  // DELETE
  @ApiSecurity("csrf")
  @Delete(":id")
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.notificationsService.remove(id, request.user.id);
  }
}
