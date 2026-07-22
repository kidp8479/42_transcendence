// TasksModule: registers the controller and service for the Task feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";
import { TaskAssigneeService } from "./task-assignees.service";

@Module({
  imports: [ProjectsModule], // needed to inject ProjectsService (assertMembership) into TasksService
  controllers: [TasksController], // handles HTTP requests
  // TaskAssigneeService has no controller/module of its own - it's a plain internal
  // helper injected into TasksService to manage the TaskAssignee join-table rows
  // (assigneeIds array) when creating or updating a task. See its file for details.
  providers: [TasksService, TaskAssigneeService], // handles database operations
  exports: [TasksService], // expose TasksService to other modules that may need it
})
export class TasksModule {}
