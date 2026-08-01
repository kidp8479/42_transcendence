// EvaluationChecklistItemsModule: registers the controller and service for the EvaluationChecklistItems feature
// NestJS will not know they exist until they are declared here

import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { EvaluationChecklistItemsService } from "./evaluation-checklist-items.service";
import { EvaluationChecklistItemsController } from "./evaluation-checklist-items.controller";

@Module({
  imports: [ProjectsModule, NotificationsModule, RealtimeModule], // ProjectsModule: ProjectsService (assertMembership). NotificationsModule: notify project members when a section reaches 100%. RealtimeModule: broadcast checkbox toggles live
  controllers: [EvaluationChecklistItemsController], // handles HTTP requests
  providers: [EvaluationChecklistItemsService], // handles database operations
  exports: [EvaluationChecklistItemsService], // expose EvaluationChecklistItemsService to other modules that may need it
})
export class EvaluationChecklistItemsModule {}
