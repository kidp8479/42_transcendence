// ProjectMembersModule: registers the controller and service for the ProjectMembers feature
// NestJS will not know they exist until they are declared here
// ProjectMember is a join table: it links a User to a Project (many-to-many relation)

import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { ProjectMembersService } from "./project-members.service";
import { ProjectMembersController } from "./project-members.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [ProjectsModule, NotificationsModule, RealtimeModule], // ProjectsModule: ProjectsService (assertMembership). NotificationsModule: notify the newly-added member. RealtimeModule: join/leave the project's socket room
  controllers: [ProjectMembersController], // handles HTTP requests
  providers: [ProjectMembersService], // handles database operations
  exports: [ProjectMembersService], // expose ProjectMembersService to other modules that may need it
})
export class ProjectMembersModule {}
