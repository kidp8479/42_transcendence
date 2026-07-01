// EvaluationChecklistItemsModule: registers the controller and service for the EvaluationChecklistItems feature
// NestJS will not know they exist until they are declared here

import { Module } from "@nestjs/common";
import { EvaluationChecklistItemsService } from "./evaluation-checklist-items.service";
import { EvaluationChecklistItemsController } from "./evaluation-checklist-items.controller";

@Module({
  controllers: [EvaluationChecklistItemsController], // handles HTTP requests
  providers: [EvaluationChecklistItemsService], // handles database operations
  exports: [EvaluationChecklistItemsService], // expose EvaluationChecklistItemsService to other modules that may need it
})
export class EvaluationChecklistItemsModule {}
