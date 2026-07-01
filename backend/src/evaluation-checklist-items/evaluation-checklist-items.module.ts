// EvaluationChecklistItemsModule: registers the controller and service for the EvaluationChecklistItems feature
// NestJS will not know they exist until they are declared here

import { Module } from "@nestjs/common";
import { EvaluationChecklistItemsService } from "./evaluation-checklist-items.service";
import { EvaluationChecklistItemsController } from "./evaluation-checklist-items.controller";

@Module({
  controllers: [EvaluationChecklistItemsController],
  providers: [EvaluationChecklistItemsService],
  exports: [EvaluationChecklistItemsService],
})
export class EvaluationChecklistItemsModule {}
