// DiscoveryBlocksModule: registers the controller and service for the DiscoveryBlocks feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { DiscoveryBlocksService } from "./discovery-blocks.service";
import { DiscoveryBlocksController } from "./discovery-blocks.controller";

@Module({
  imports: [ProjectsModule, RealtimeModule], // ProjectsModule: assertMembership. RealtimeModule: broadcast title/description/notes/color/icon changes live
  controllers: [DiscoveryBlocksController], // handles HTTP requests
  providers: [DiscoveryBlocksService], // handles database operations
  exports: [DiscoveryBlocksService], // expose DiscoveryBlocksService to other modules that may need it
})
export class DiscoveryBlocksModule {}
