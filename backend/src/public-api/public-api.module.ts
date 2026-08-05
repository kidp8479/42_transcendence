import { Module } from "@nestjs/common";
import { CalendarEventsModule } from "../calendar-events/calendar-events.module";
import { DiscoveryBlocksModule } from "../discovery-blocks/discovery-blocks.module";
import { TasksModule } from "../tasks/tasks.module";
import { PublicProjectReadController } from "./public-project-read.controller";

@Module({
  imports: [TasksModule, CalendarEventsModule, DiscoveryBlocksModule],
  controllers: [PublicProjectReadController],
})
export class PublicApiModule {}
