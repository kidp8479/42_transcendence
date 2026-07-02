import { Module } from "@nestjs/common";
import { TaskCategoryService } from "./task-categories.service";
import { TaskCategoryController } from "./task-categories.controller";

@Module({
  controllers: [TaskCategoryController],
  providers: [TaskCategoryService],
  exports: [TaskCategoryService],
})
export class TaskCategoryModule {}
