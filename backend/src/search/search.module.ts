// SearchModule: registers the controller and service for the Search feature
// NestJS will not know they exist until they are declared here, and in
// app.module.ts's imports array

import { Module } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchController } from "./search.controller";

@Module({
  // No imports on purpose. PrismaModule is @Global(), so PrismaService needs no
  // entry here; and unlike every other feature module this one does NOT import
  // ProjectsModule, because assertMembership is per-project and a cross-project
  // search would turn it into one query per project. The membership predicates
  // live inline in the service instead.
  controllers: [SearchController], // handles HTTP requests
  providers: [SearchService], // handles database operations
  exports: [SearchService], // expose SearchService to other modules that may need it
})
export class SearchModule {}
