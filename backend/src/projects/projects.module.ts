import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { RealtimeModule } from "../realtime/realtime.module";

// ProjectsModule: registers the controller and service for the Projects feature
// NestJS will not know they exist until they are declared here
@Module({
  imports: [RealtimeModule], // RealtimeModule: join the creator's socket to the new project's room
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService], // expose ProjectsService to other modules that may need it
})
export class ProjectsModule {}
