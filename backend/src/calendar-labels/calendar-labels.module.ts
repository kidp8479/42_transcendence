import { Module } from "@nestjs/common";
import { CalendarLabelsService } from "./calendar-labels.service";
import { CalendarLabelsController } from "./calendar-labels.controller";

@Module({
  controllers: [CalendarLabelsController],
  providers: [CalendarLabelsService],
  exports: [CalendarLabelsService],
})
export class CalendarLabelsModule {}
