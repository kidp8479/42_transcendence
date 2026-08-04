// ChatModule: registers the controller and service for the Chat feature
// NestJS will not know they exist until they are declared here

import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ProjectsModule } from "../projects/projects.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [ProjectsModule, RealtimeModule], // ProjectsModule: ProjectsService (assertMembership). RealtimeModule: broadcast new/deleted messages live
  controllers: [ChatController],
  providers: [ChatService],
  exports: [],
})
export class ChatModule {}
