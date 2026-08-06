import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ProjectApiTokensController } from "./project-api-tokens.controller";
import { ProjectApiTokensService } from "./project-api-tokens.service";

@Module({
  imports: [ProjectsModule, RealtimeModule],
  controllers: [ProjectApiTokensController],
  providers: [ProjectApiTokensService],
})
export class ProjectApiTokensModule {}
