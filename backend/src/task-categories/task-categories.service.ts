// TaskCategoriesService: handles all database operations for TaskCategories
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class TaskCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService
  ) {}

  // Read-only for now, on purpose: a project's categories are the defaults
  // seeded by ProjectsService.create() (DEFAULT_TASK_CATEGORIES), and no screen
  // lets anyone add or rename one yet. create/findById/update/remove land with
  // the project-settings screen - CalendarCategoriesService already has the
  // exact shape they should take, including the findById-as-access-guard trick.
  async findAll(projectId: string, userId: string) {
    // Membership first: :projectId alone proves nothing, so without this any
    // authenticated user could read another project's categories just by
    // editing the URL (IDOR). It throws NotFoundException rather than
    // Forbidden, so a non-member can't even confirm the project exists.
    await this.projectsService.assertMembership(projectId, userId);
    return this.prisma.taskCategory.findMany({
      where: { projectId: projectId },
      // Postgres guarantees no order without this. Alphabetical rather than by
      // color index: it stays sensible once the settings screen lets people
      // pick their own colors, and it matches CalendarCategoriesService.
      orderBy: { name: "asc" },
    });
  }
}
