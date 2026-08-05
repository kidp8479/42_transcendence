import { Module } from "@nestjs/common";
import { CalendarEventsModule } from "../calendar-events/calendar-events.module";
import { DiscoveryBlocksModule } from "../discovery-blocks/discovery-blocks.module";
import { TasksModule } from "../tasks/tasks.module";
import { PublicProjectController } from "./public-project.controller";
import { ProjectApiTokenWriteRateLimitGuard } from "../auth/project-api-token-write-rate-limit.guard";

@Module({
  imports: [TasksModule, CalendarEventsModule, DiscoveryBlocksModule],
  controllers: [PublicProjectController],
  providers: [ProjectApiTokenWriteRateLimitGuard],
})
export class PublicApiModule {}
