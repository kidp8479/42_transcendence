// ProjectMembersModule: registers the controller and service for the ProjectMembers feature
// NestJS will not know they exist until they are declared here
// ProjectMember is a join table: it links a User to a Project (many-to-many relation)

import { Module } from "@nestjs/common";
import { ProjectMembersService } from "./project-members.service";
import { ProjectMembersController } from "./project-members.controller";

@Module({
  controllers: [ProjectMembersController], // handles HTTP requests
  providers: [ProjectMembersService], // handles database operations
  exports: [ProjectMembersService], // expose ProjectMembersService to other modules that may need it
})
export class ProjectMembersModule {}
