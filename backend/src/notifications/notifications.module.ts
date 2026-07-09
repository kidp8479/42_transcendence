// NotificationsModule: registers the controller and service for the Notifications feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Module({
  controllers: [NotificationsController], // handles HTTP requests
  providers: [NotificationsService], // handles database operations
  exports: [NotificationsService], // expose NotificationsService to other modules that may need it
})
export class NotificationsModule {}
