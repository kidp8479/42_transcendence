// DiscoveryBlockItemsModule: registers the controller and service for the DiscoveryBlockItems feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { DiscoveryBlocksModule } from "../discovery-blocks/discovery-blocks.module";
import { DiscoveryBlockItemsService } from "./discovery-block-items.service";
import { DiscoveryBlockItemsController } from "./discovery-block-items.controller";

@Module({
  imports: [DiscoveryBlocksModule],
  controllers: [DiscoveryBlockItemsController], // handles HTTP requests
  providers: [DiscoveryBlockItemsService], // handles database operations
  exports: [DiscoveryBlockItemsService], // expose DiscoveryBlockItemsService to other modules that may need it
})
export class DiscoveryBlockItemsModule {}
