import { Module } from "@nestjs/common";
import { CalendarEventsModule } from "../calendar-events/calendar-events.module";
import { DiscoveryBlocksModule } from "../discovery-blocks/discovery-blocks.module";
import { TasksModule } from "../tasks/tasks.module";
import { PublicProjectController } from "./public-project.controller";
import { PublicTokenController } from "./public-token.controller";
import { ProjectApiTokenWriteRateLimitGuard } from "../auth/project-api-token-write-rate-limit.guard";

@Module({
  imports: [TasksModule, CalendarEventsModule, DiscoveryBlocksModule],
  controllers: [PublicProjectController, PublicTokenController],
  providers: [ProjectApiTokenWriteRateLimitGuard],
})
export class PublicApiModule {}
