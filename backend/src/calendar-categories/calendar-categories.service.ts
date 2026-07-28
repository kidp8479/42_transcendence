// CalendarCategoriesService: handles all database operations for CalendarCategories
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { CreateCalendarCategoryDto } from "./dto/create-calendar-category.dto";
import { UpdateCalendarCategoryDto } from "./dto/update-calendar-category.dto";

@Injectable()
export class CalendarCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService
  ) {}

  async create(
    projectId: string,
    dto: CreateCalendarCategoryDto,
    userId: string
  ) {
    await this.projectsService.assertMembership(projectId, userId);
    return this.prisma.calendarCategory.create({
      data: {
        name: dto.name,
        color: dto.color,
        projectId: projectId, // does not come from the dto but from the url
      },
    });
  }

  async findAll(projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    return this.prisma.calendarCategory.findMany({
      where: { projectId: projectId },
      orderBy: { name: "asc" },
    });
  }

  // also reused by update/remove as their access guard: it already checks both
  // "is userId a member of projectId" and "does this id belong to projectId",
  // and throws the right NotFoundException in each case
  async findById(id: string, projectId: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);
    const category = await this.prisma.calendarCategory.findFirst({
      where: { id: id, projectId: projectId },
    });
    if (!category) {
      throw new NotFoundException("Calendar category not found");
    }
    return category;
  }

  async update(
    id: string,
    dto: UpdateCalendarCategoryDto,
    projectId: string,
    userId: string
  ) {
    await this.findById(id, projectId, userId); // access guard, see findById's own comment
    return this.prisma.calendarCategory.update({
      where: { id: id },
      data: { ...dto },
    });
  }

  async remove(id: string, projectId: string, userId: string) {
    await this.findById(id, projectId, userId); // access guard, see findById's own comment
    return this.prisma.calendarCategory.delete({ where: { id: id } });
  }
}
