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
    // only the label is lock-gated - isChecked/order are "last one wins" by
    // design (see the frontend's own comment on this), so a checkbox toggle
    // must go through even while someone else holds the label's edit lock.
    // Without this check, a second member could still PATCH the label
    // straight past a lock their own UI shows as read-only (replay, race,
    // or a client bug) - the field-lock hook is otherwise a UI hint only.
    if (
      dto.label !== undefined &&
      this.realtimeService.isLockedByOther(`checklist-item:${id}`, userId)
    ) {
      throw new ForbiddenException("This item is being edited by someone else");
    }
    const previousPercent = computeSectionPercent(
      await this.prisma.evaluationChecklistItem.findMany({
        where: { projectId: projectId, section: existingItem.section },
        select: { isChecked: true },
      })
    );

    // safe to update by id alone now - findById already proved it belongs
    // to projectId.
    let updatedItem;
    try {
      updatedItem = await this.prisma.evaluationChecklistItem.update({
        where: { id: id },
        data: { ...dto },
      });
    } catch (error) {
      // someone else deleted this item in the race window between findById
      // above and this update - a clean 404 instead of Prisma's raw
      // "record to update not found" text leaking to the client
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException("Checklist item not found");
      }
      throw error;
    }
    // only isChecked toggling (not label/order) can ever move a section's
    // percent, but recomputing unconditionally is simpler than tracking
    // which field changed, same reasoning as DiscoveryBlocksService
    await this.notifySectionIfJustCompleted(
      projectId,
      existingItem.section,
      previousPercent,
      userId
    );
    this.realtimeService.emitToProject(
      projectId,
      "checklist-item:updated",
      updatedItem
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

    // two members deleting the same item within the same race window both
    // want it gone - the second delete isn't really a failure, so treat it
    // as one instead of surfacing Prisma's raw "record not found" text
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
    // the deleted item's own label lock (if any) will never be released by
    // its holder now - findById would 404 for anyone who tried, so nothing
    // would ever clear it otherwise until they disconnect
    this.realtimeService.forceReleaseLock(`checklist-item:${id}`);
    // deleting the last unchecked item in a section can itself push it to
    // 100%, same as checking it would
    await this.notifySectionIfJustCompleted(
      projectId,
      existingItem.section,
      previousPercent,
      userId
    );
    this.realtimeService.emitToProject(
      projectId,
      "checklist-item:deleted",
      deletedItem
    );
    return deletedItem;
  }
}
