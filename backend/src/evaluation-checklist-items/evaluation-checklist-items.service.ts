// EvaluationChecklistItemsService: handles all database operations for EvaluationChecklistItems
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, EvaluationChecklistItemSection } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import { FieldLockLeaseError } from "../realtime/field-lock-manager";
import { isRecordNotFoundError } from "../common/is-record-not-found-error";
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
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService
  ) {
    // teaches the gateway how to resolve a "checklist-item:<id>" key's real
    // projectId, so it can validate a field:lock/unlock/query without this
    // service's model leaking into realtime.gateway.ts
    this.realtimeService.registerKeyPrefixValidator(
      "checklist-item",
      async (id) => {
        const item = await this.prisma.evaluationChecklistItem.findUnique({
          where: { id },
          select: { projectId: true },
        });
        return item?.projectId;
      }
    );
  }
  // strictly equivalent to the lesser expanded (yet more readable) form:
  //  prisma: PrismaService;
  //  projectsService: ProjectsService;
  //  notificationsService: NotificationsService;
  //  realtimeService: RealtimeService;
  //  constructor(prisma: PrismaService, projectsService: ProjectsService, notificationsService: NotificationsService, realtimeService: RealtimeService) {
  //    this.prisma = prisma;
  //    this.projectsService = projectsService;
  //    this.notificationsService = notificationsService;
  //    this.realtimeService = realtimeService;
  //  }

  // called after update/remove below, with the section's percent computed
  // just before that mutation - notifies every other project member (not
  // the acting user, who already knows what they just did) only on a real
  // <100 => 100 crossing, never on a mutation that leaves an already-100%
  // section untouched.
  //
  // currentItems is the same section list the caller already fetched for
  // previousPercent, transformed in-memory to reflect the mutation that
  // just happened (item's isChecked flipped, or the deleted item filtered
  // out) - avoids a second full-section findMany right after the first.
  private async notifySectionIfJustCompleted(
    projectId: string,
    section: EvaluationChecklistItemSection,
    previousPercent: number,
    currentItems: { isChecked: boolean }[],
    actingUserId: string
  ): Promise<void> {
    if (previousPercent >= 100) {
      return;
    }

    if (computeSectionPercent(currentItems) < 100) {
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

    // each member's insert + socket emit is independent - run them
    // concurrently instead of awaiting one at a time, so this PATCH/DELETE
    // response isn't delayed by N sequential DB round-trips on a project
    // with N members
    await Promise.all(
      members
        .filter((member) => member.userId !== actingUserId)
        .map((member) =>
          this.notificationsService.create(
            member.userId,
            `${SECTION_LABELS[section]} reached 100% on "${project.name}"`,
            `/${projectId}/evaluation-checklist`
          )
        )
    );
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
    const createdItem = await this.prisma.transaction(
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
    this.realtimeService.emitToProject(
      projectId,
      "checklist-item:created",
      createdItem
    );
    return createdItem;
  }

  // PATCH (partial update)
  async update(
    projectId: string,
    id: string,
    dto: UpdateEvaluationChecklistItemDto,
    userId: string,
    fieldLockToken: string | undefined
  ) {
    // ownership check via findById, will throw if failed: confirms both that
    // userId is a member of projectId AND that id actually belongs to
    // projectId - without the second check, a member of any project could
    // PATCH any other project's item just by pairing their own projectId
    // (to pass the membership half) with a foreign item id (IDOR).
    // its return value is also reused below - it already carries this
    // item's section, no need for a second query.
    const updateItem = async (
      existingItem: Awaited<ReturnType<typeof this.findById>>
    ) => {
      const sectionItems = await this.prisma.evaluationChecklistItem.findMany({
        where: { projectId: projectId, section: existingItem.section },
        select: { id: true, isChecked: true },
      });
      const previousPercent = computeSectionPercent(sectionItems);

      let updatedItem;
      try {
        updatedItem = await this.prisma.evaluationChecklistItem.update({
          where: { id: id },
          data: { ...dto },
        });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          throw new NotFoundException("Checklist item not found");
        }
        throw error;
      }
      return { existingItem, sectionItems, previousPercent, updatedItem };
    };

    let result;
    if (dto.label !== undefined) {
      let existingItem: Awaited<ReturnType<typeof this.findById>>;
      try {
        result = await this.realtimeService.withValidatedFieldLock(
          projectId,
          `checklist-item:${id}`,
          userId,
          fieldLockToken,
          async () => {
            existingItem = await this.findById(projectId, id, userId);
          },
          async () => updateItem(existingItem)
        );
      } catch (error) {
        if (error instanceof FieldLockLeaseError) {
          throw new ForbiddenException(
            "A current editing lease is required to update this item"
          );
        }
        throw error;
      }
    } else {
      result = await updateItem(await this.findById(projectId, id, userId));
    }

    // only isChecked toggling (not label/order) can ever move a section's
    // percent, but recomputing unconditionally is simpler than tracking
    // which field changed, same reasoning as DiscoveryBlocksService.
    // sectionItems patched in-memory with this update's new isChecked
    // instead of a second findMany - it's the same list, just one row changed.
    await this.notifySectionIfJustCompleted(
      projectId,
      result.existingItem.section,
      result.previousPercent,
      result.sectionItems.map((item) =>
        item.id === id ? { isChecked: result.updatedItem.isChecked } : item
      ),
      userId
    );
    this.realtimeService.emitToProject(
      projectId,
      "checklist-item:updated",
      result.updatedItem
    );
    return result.updatedItem;
  }

  // DELETE
  async remove(
    projectId: string,
    id: string,
    userId: string,
    fieldLockToken: string | undefined
  ) {
    let result;
    try {
      result = await this.realtimeService.withProjectFieldLock(
        projectId,
        `checklist-item:${id}`,
        async () => {
          this.realtimeService.assertFieldLockOwnerIfLocked(
            `checklist-item:${id}`,
            userId,
            fieldLockToken
          );
          const existingItem = await this.findById(projectId, id, userId);
          const sectionItems =
            await this.prisma.evaluationChecklistItem.findMany({
              where: { projectId: projectId, section: existingItem.section },
              select: { id: true, isChecked: true },
            });
          const previousPercent = computeSectionPercent(sectionItems);

          let deletedItem = existingItem;
          try {
            deletedItem = await this.prisma.evaluationChecklistItem.delete({
              where: { id: id },
            });
          } catch (error) {
            if (!isRecordNotFoundError(error)) {
              throw error;
            }
          }
          return {
            existingItem,
            sectionItems,
            previousPercent,
            deletedItem,
            released: this.realtimeService.releaseFieldLockForResource(
              `checklist-item:${id}`
            ),
          };
        }
      );
    } catch (error) {
      if (error instanceof FieldLockLeaseError) {
        throw new ForbiddenException(
          "This item is currently being edited by someone else"
        );
      }
      throw error;
    }
    if (result.released !== undefined) {
      this.realtimeService.emitFieldUnlock(result.released);
    }
    // deleting the last unchecked item in a section can itself push it to
    // 100%, same as checking it would. sectionItems filtered in-memory
    // instead of a second findMany - it's the same list minus this row.
    await this.notifySectionIfJustCompleted(
      projectId,
      result.existingItem.section,
      result.previousPercent,
      result.sectionItems.filter((item) => item.id !== id),
      userId
    );
    this.realtimeService.emitToProject(
      projectId,
      "checklist-item:deleted",
      result.deletedItem
    );
    return result.deletedItem;
  }
}
