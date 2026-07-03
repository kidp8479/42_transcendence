// TaskCategoriesModule: registers the controller and service for the TaskCategories feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { TaskCategoriesService } from "./task-categories.service";
import { TaskCategoriesController } from "./task-categories.controller";

@Module({
  controllers: [TaskCategoriesController],
  providers: [TaskCategoriesService],
  exports: [TaskCategoriesService],
})
export class TaskCategoriesModule {}
