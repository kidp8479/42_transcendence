// DiscoveryBlockItemsService: handles all database operations for DiscoveryBlockItems
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DiscoveryBlocksService } from "../discovery-blocks/discovery-blocks.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CreateDiscoveryBlockItemDto } from "./dto/create-discovery-block-item.dto";
import { UpdateDiscoveryBlockItemDto } from "./dto/update-discovery-block-item.dto";

// see discovery-blocks.service.ts's own comment on this same convention
const MAX_ITEMS_PER_DISCOVERY_BLOCK = 30;

@Injectable()
export class DiscoveryBlockItemsService {
  prisma: PrismaService;
  discoveryBlocksService: DiscoveryBlocksService;
  realtimeService: RealtimeService;
  constructor(
    prisma: PrismaService,
    discoveryBlocksService: DiscoveryBlocksService,
    realtimeService: RealtimeService
  ) {
    this.prisma = prisma;
    this.discoveryBlocksService = discoveryBlocksService;
    this.realtimeService = realtimeService;
  }

  // GET (all)
  async findAll(projectId: string, discoveryBlockId: string, userId: string) {
    // guard, reuses the one from discoveryBlocksService, will check membership and project ownership in one call
    await this.discoveryBlocksService.findById(
      projectId,
      discoveryBlockId,
      userId
    );
    // where you really retrieve what you want after the guard check.
    // orderBy: without it Postgres gives no ordering guarantee at all, and
    // the `order` field exists on this model specifically to control
    // checklist row order
    const blockItems = await this.prisma.discoveryBlockItem.findMany({
      where: { discoveryBlockId: discoveryBlockId },
      orderBy: { order: "asc" },
    });
    // don't check for if (!blockItems) - an empty array is a valid result, not a 404
    return blockItems;
  }

  // POST
  async create(
    projectId: string,
    discoveryBlockId: string,
    dto: CreateDiscoveryBlockItemDto,
    userId: string
  ) {
    // guard (assert membership + check project ownership)
    await this.discoveryBlocksService.findById(
      projectId,
      discoveryBlockId,
      userId
    );

    // same Serializable-transaction fix as DiscoveryBlocksService.create(),
    // for the same count-then-create TOCTOU reason
    const blockItem = await this.prisma.transaction(
      async (transactionPrisma) => {
        const existingItemCount =
          await transactionPrisma.discoveryBlockItem.count({
            where: { discoveryBlockId: discoveryBlockId },
          });
        if (existingItemCount >= MAX_ITEMS_PER_DISCOVERY_BLOCK) {
          throw new BadRequestException(
            `A discovery block can have at most ${MAX_ITEMS_PER_DISCOVERY_BLOCK} items`
          );
        }

        return transactionPrisma.discoveryBlockItem.create({
          data: {
            label: dto.label,
            order: dto.order,
            discoveryBlockId: discoveryBlockId, // does not comes from the dto but from the url !
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    // outside this create's own transaction on purpose - status is a
    // derived/display value, not a business invariant like the item cap
    // above, so it doesn't need to be atomic with the item insert itself.
    // recalculateStatus still protects its own read-then-write internally
    // (see its own comment), just as a separate transaction.
    await this.discoveryBlocksService.recalculateStatus(discoveryBlockId);
    this.realtimeService.emitToProject(
      projectId,
      "discovery-item:created",
      blockItem
    );
    return blockItem;
  }

  // GET (one)
  // also reused by update/remove as their access guard: it already checks
  // membership + block ownership (via discoveryBlocksService.findById) and
  // that this item id belongs to discoveryBlockId, throwing the right
  // NotFoundException in each case
  async findById(
    projectId: string,
    discoveryBlockId: string,
    id: string,
    userId: string
  ) {
    await this.discoveryBlocksService.findById(
      projectId,
      discoveryBlockId,
      userId
    );

    const blockItem = await this.prisma.discoveryBlockItem.findFirst({
      where: { id: id, discoveryBlockId: discoveryBlockId },
    });
    if (!blockItem) {
      throw new NotFoundException("Discovery block item not found");
    }
    return blockItem;
  }

  // PATCH
  async update(
    projectId: string,
    discoveryBlockId: string,
    id: string,
    dto: UpdateDiscoveryBlockItemDto,
    userId: string
  ) {
    await this.findById(projectId, discoveryBlockId, id, userId); // access guard, see findById's own comment

    const updatedItem = await this.prisma.discoveryBlockItem.update({
      where: { id: id },
      data: { ...dto },
    });
    // recomputed on every update, not just when isChecked is sent - simpler
    // than tracking which field changed, and the total item count never
    // changes here so a label/order-only update is a harmless no-op recompute
    await this.discoveryBlocksService.recalculateStatus(discoveryBlockId);
    this.realtimeService.emitToProject(
      projectId,
      "discovery-item:updated",
      updatedItem
    );
    return updatedItem;
  }

  // DELETE
  async remove(
    projectId: string,
    discoveryBlockId: string,
    id: string,
    userId: string
  ) {
    await this.findById(projectId, discoveryBlockId, id, userId); // access guard, see findById's own comment

    const deletedItem = await this.prisma.discoveryBlockItem.delete({
      where: { id: id },
    });
    // recalculated after the delete, so the removed item is already excluded
    // from the count/ratio
    await this.discoveryBlocksService.recalculateStatus(discoveryBlockId);
    this.realtimeService.emitToProject(
      projectId,
      "discovery-item:deleted",
      deletedItem
    );
    return deletedItem;
  }
}
