// CalendarCategoriesModule: registers the controller and service for the CalendarCategories feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { CalendarCategoriesService } from "./calendar-categories.service";
import { CalendarCategoriesController } from "./calendar-categories.controller";

@Module({
  imports: [ProjectsModule], // needed to inject ProjectsService (assertMembership) into CalendarCategoriesService
  controllers: [CalendarCategoriesController],
  providers: [CalendarCategoriesService],
  exports: [CalendarCategoriesService],
})
export class CalendarCategoriesModule {}
