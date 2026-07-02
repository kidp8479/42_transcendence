import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

// ProjectsModule groups all project-related logic together:
// - Controller: handles HTTP routes (/projects)
// - Service: contains business logic (DB calls, rules, etc.)
// TODO: What still needs to be added:
// - Controller endpoints:
//   - GET /projects
//   - GET /projects/:id
//   - POST /projects
//   - PATCH /projects/:id
//   - DELETE /projects/:id
// - Service logic:
//   - Prisma integration (CRUD operations)
//   - Business rules (project status, archiving, etc.)
// - Future improvements:
//   - DTO validation (class-validator or Zod)
//   - Auth guards (who can access projects)
//   - Pagination / filtering
@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService], // expose ProjectsService to other modules that may need it
})
export class ProjectsModule {}
