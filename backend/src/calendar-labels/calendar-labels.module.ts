// CalendarLabelsModule: registers the controller and service for the CalendarLabels feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { CalendarLabelsService } from "./calendar-labels.service";
import { CalendarLabelsController } from "./calendar-labels.controller";

@Module({
  controllers: [CalendarLabelsController],
  providers: [CalendarLabelsService],
  exports: [CalendarLabelsService],
})
export class CalendarLabelsModule {}
