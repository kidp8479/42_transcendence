// EvaluationChecklistItemsService: handles all database operations for EvaluationChecklistItems
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { CreateEvaluationChecklistItemDto } from "./dto/create-evaluation-checklist-item.dto";
import { UpdateEvaluationChecklistItemDto } from "./dto/update-evaluation-checklist-item.dto";

@Injectable()
export class EvaluationChecklistItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService
  ) {}
  // strictly equivalent to the lesser expanded (yet more readable) form:
  //  prisma: PrismaService;
  //  projectsService: ProjectsService;
  //  constructor(prisma: PrismaService, projectsService: ProjectsService) {
  //    this.prisma = prisma;
  //    this.projectsService = projectsService;
  //  }

  // GET (all)
  async findAll(projectId: string, userId: string) {
    // membership check, will throw if failed
    await this.projectsService.assertMembership(projectId, userId);

    // query database
    const items = await this.prisma.evaluationChecklistItem.findMany({
      where: {
        projectId: projectId,
      },
    });
    return items;
  }

  // GET (one)
  // also reused by update/remove as their access guard: it already checks both
  // "is userId a member of projectId" and "does this id belong to projectId",
  // and throws the right NotFoundException in each case
  async findById(projectId: string, id: string, userId: string) {
    // membership check, will throw if failed
    await this.projectsService.assertMembership(projectId, userId);

    // query database
    const item = await this.prisma.evaluationChecklistItem.findFirst({
      where: { id: id, projectId: projectId },
    });

    if (!item) {
      throw new NotFoundException("Checklist item not found");
    }
    return item;
  }

  // POST
  async create(
    projectId: string,
    dto: CreateEvaluationChecklistItemDto,
    userId: string
  ) {
    // membership check, will throw if failed
    await this.projectsService.assertMembership(projectId, userId);

    // query database
    const item = await this.prisma.evaluationChecklistItem.create({
      data: {
        label: dto.label,
        section: dto.section,
        order: dto.order,
        project: { connect: { id: projectId } },
      },
    });
    return item;
  }

  // PATCH (partial update)
  async update(
    projectId: string,
    id: string,
    dto: UpdateEvaluationChecklistItemDto,
    userId: string
  ) {
    // membership check, will throw if failed
    await this.projectsService.assertMembership(projectId, userId);

    // query database
    const updatedItem = await this.prisma.evaluationChecklistItem.update({
      where: { id: id },
      data: { ...dto },
    });
    return updatedItem;
  }

  // DELETE
  async remove(projectId: string, id: string, userId: string) {
    // membership check via findById, will throw if failed. Result is discarded.
    await this.findById(projectId, id, userId);

    // database query
    const deletedItem = await this.prisma.evaluationChecklistItem.delete({
      where: { id: id },
    });
    return deletedItem;
  }
}

// code your logic here
// all methods below will use PrismaService to query the database
// none of these are called directly by the frontend - always via the controller
// TODO: inject PrismaService here via constructor
// the constructor is called automatically by NestJS at startup - never called manually
// TODO: inject ProjectsService here via constructor (for assertMembership below)
// TODO: create(projectId: string, dto: CreateEvaluationChecklistItemDto, userId: string)
//       => call projectsService.assertMembership(projectId, userId) first (shared check,
//          throws NotFoundException if not a member - no role required, any member can do this)
//       => insert a new checklist item in the database, linked to projectId from the URL
// TODO: findAll(projectId: string, userId: string)
//       => same assertMembership call as create
//       => fetch all checklist items belonging to a given project
// TODO: findById(id: string, projectId: string, userId: string)
//       => same assertMembership call as create, then fetch with where: { id, projectId }
//          (see DiscoveryBlocksService.findById for a full example of this pattern)
// TODO: update(id: string, dto: UpdateEvaluationChecklistItemDto, projectId: string, userId: string)
//       => same membership check as findById
//       => update an existing item (label, section, or isChecked)
// TODO: remove(id: string, projectId: string, userId: string)
//       => same membership check as findById
//       => permanently delete a checklist item
