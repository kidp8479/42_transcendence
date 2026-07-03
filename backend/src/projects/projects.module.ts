import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

// ProjectsModule: registers the controller and service for the Projects feature
// NestJS will not know they exist until they are declared here
@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService], // expose ProjectsService to other modules that may need it
})
export class ProjectsModule {}
