// EvaluationChecklistItemsService: handles all database operations for EvaluationChecklistItems
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { CreateEvaluationChecklistItemDto } from "./dto/create-evaluation-checklist-item.dto";
import { UpdateEvaluationChecklistItemDto } from "./dto/update-evaluation-checklist-item.dto";
import { EVALUATION_CHECKLIST_MAX_ITEMS_PER_SECTION } from "./evaluation-checklist-items.constants";

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

    // count-then-create is a TOCTOU race in general (two concurrent requests
    // could both read a count under the cap, then both insert) - wrapped in
    // a Serializable transaction so Postgres itself rejects the second
    // transaction if it would have read stale data. Same pattern as
    // ProjectsService.create() and DiscoveryBlocksService.create().
    return await this.prisma.transaction(
      async (transactionPrisma) => {
        const existingItemCount =
          await transactionPrisma.evaluationChecklistItem.count({
            where: { projectId: projectId, section: dto.section },
          });
        if (existingItemCount >= EVALUATION_CHECKLIST_MAX_ITEMS_PER_SECTION) {
          throw new BadRequestException(
            `A section can have at most ${EVALUATION_CHECKLIST_MAX_ITEMS_PER_SECTION} checklist items`
          );
        }

        return transactionPrisma.evaluationChecklistItem.create({
          data: {
            label: dto.label,
            section: dto.section,
            order: dto.order,
            project: { connect: { id: projectId } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  // PATCH (partial update)
  async update(
    projectId: string,
    id: string,
    dto: UpdateEvaluationChecklistItemDto,
    userId: string
  ) {
    // membership check, will throw if failed
    await this.findById(projectId, id, userId);

    // query database
    return await this.prisma.evaluationChecklistItem.update({
      where: { id: id },
      data: { ...dto },
    });
  }

  // DELETE
  async remove(projectId: string, id: string, userId: string) {
    // membership check via findById, will throw if failed. Result is discarded.
    await this.findById(projectId, id, userId);

    // database query
    return await this.prisma.evaluationChecklistItem.delete({
      where: { id: id },
    });
  }
}
