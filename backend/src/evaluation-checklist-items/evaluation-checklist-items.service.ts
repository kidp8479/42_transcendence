// EvaluationChecklistItemsService: handles all database operations for EvaluationChecklistItems
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, EvaluationChecklistItemSection } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateEvaluationChecklistItemDto } from "./dto/create-evaluation-checklist-item.dto";
import { UpdateEvaluationChecklistItemDto } from "./dto/update-evaluation-checklist-item.dto";
import { EVALUATION_CHECKLIST_MAX_ITEMS_PER_SECTION } from "./evaluation-checklist-items.constants";

// Same rounding rule as computeProjectProgress's own per-section helper in
// projects.service.ts, kept separate on purpose - that one feeds the capped
// overall project percent, this one only cares about a single section
// crossing 100% for notification purposes.
function computeSectionPercent(items: { isChecked: boolean }[]): number {
  if (items.length === 0) {
    return 0;
  }
  const checked = items.filter((item) => item.isChecked).length;
  return Math.round((checked / items.length) * 100);
}

const SECTION_LABELS: Record<EvaluationChecklistItemSection, string> = {
  MANDATORY: "Mandatory Part",
  BONUS: "Bonus Part",
  SUPPLEMENTAL: "Supplemental Goal",
};

@Injectable()
export class EvaluationChecklistItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly notificationsService: NotificationsService
  ) {}
  // strictly equivalent to the lesser expanded (yet more readable) form:
  //  prisma: PrismaService;
  //  projectsService: ProjectsService;
  //  notificationsService: NotificationsService;
  //  constructor(prisma: PrismaService, projectsService: ProjectsService, notificationsService: NotificationsService) {
  //    this.prisma = prisma;
  //    this.projectsService = projectsService;
  //    this.notificationsService = notificationsService;
  //  }

  // called after create/update/remove below, with the section's percent
  // computed just before that mutation - notifies every other project
  // member (not the acting user, who already knows what they just did)
  // only on a real <100 => 100 crossing, never on a mutation that leaves
  // an already-100% section untouched.
  private async notifySectionIfJustCompleted(
    projectId: string,
    section: EvaluationChecklistItemSection,
    previousPercent: number,
    actingUserId: string
  ): Promise<void> {
    if (previousPercent >= 100) {
      return;
    }

    const items = await this.prisma.evaluationChecklistItem.findMany({
      where: { projectId: projectId, section: section },
      select: { isChecked: true },
    });
    if (computeSectionPercent(items) < 100) {
      return;
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true },
    });
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: projectId },
      select: { userId: true },
    });

    for (const member of members) {
      if (member.userId === actingUserId) {
        continue;
      }
      await this.notificationsService.create(
        member.userId,
        `${SECTION_LABELS[section]} reached 100% on "${project.name}"`,
        `/projects/${projectId}/evaluation-checklist`
      );
    }
  }

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
    // ownership check via findById, will throw if failed: confirms both that
    // userId is a member of projectId AND that id actually belongs to
    // projectId - without the second check, a member of any project could
    // PATCH any other project's item just by pairing their own projectId
    // (to pass the membership half) with a foreign item id (IDOR).
    // its return value is also reused below - it already carries this
    // item's section, no need for a second query.
    const existingItem = await this.findById(projectId, id, userId);
    const previousPercent = computeSectionPercent(
      await this.prisma.evaluationChecklistItem.findMany({
        where: { projectId: projectId, section: existingItem.section },
        select: { isChecked: true },
      })
    );

    // safe to update by id alone now - findById already proved it belongs
    // to projectId.
    const updatedItem = await this.prisma.evaluationChecklistItem.update({
      where: { id: id },
      data: { ...dto },
    });
    // only isChecked toggling (not label/order) can ever move a section's
    // percent, but recomputing unconditionally is simpler than tracking
    // which field changed, same reasoning as DiscoveryBlocksService
    await this.notifySectionIfJustCompleted(
      projectId,
      existingItem.section,
      previousPercent,
      userId
    );
    return updatedItem;
  }

  // DELETE
  async remove(projectId: string, id: string, userId: string) {
    // membership check via findById, will throw if failed - its return
    // value is reused below (section, for the same reason as update()).
    const existingItem = await this.findById(projectId, id, userId);
    const previousPercent = computeSectionPercent(
      await this.prisma.evaluationChecklistItem.findMany({
        where: { projectId: projectId, section: existingItem.section },
        select: { isChecked: true },
      })
    );

    // database query
    const deletedItem = await this.prisma.evaluationChecklistItem.delete({
      where: { id: id },
    });
    // deleting the last unchecked item in a section can itself push it to
    // 100%, same as checking it would
    await this.notifySectionIfJustCompleted(
      projectId,
      existingItem.section,
      previousPercent,
      userId
    );
    return deletedItem;
  }
}
