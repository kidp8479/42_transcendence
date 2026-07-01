// EvaluationChecklistItemsModule: registers the controller and service for the EvaluationChecklistItems feature
// NestJS will not know they exist until they are declared here

import { Module } from "@nestjs/common";
import { CalendarEventsService } from "./calendar-events.service";
import { CalendarEventsController } from "./calendar-events.controller";

@Module({
  controllers: [CalendarEventsController], // handles HTTP requests
  providers: [CalendarEventsService], // handles database operations
  exports: [CalendarEventsService], // expose CalendarEventsService to other modules that may need it
})
export class CalendarEventsModule {}
