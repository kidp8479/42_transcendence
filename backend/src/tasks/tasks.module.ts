// TasksModule: registers the controller and service for the Task feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";

@Module({
  controllers: [TasksController], // handles HTTP requests
  providers: [TasksService], // handles database operations
  exports: [TasksService], // expose TasksService to other modules that may need it
})
export class TasksModule {}
