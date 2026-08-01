// DiscoveryBlocksService: handles all database operations for DiscoveryBlocks
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { RealtimeService } from "../realtime/realtime.service";
import { FieldLockLeaseError } from "../realtime/field-lock-manager";
import { isRecordNotFoundError } from "../common/is-record-not-found-error";
import { CreateDiscoveryBlockDto } from "./dto/create-discovery-block.dto";
import { UpdateDiscoveryBlockDto } from "./dto/update-discovery-block.dto";
import { computeDiscoveryBlockStatus } from "./discovery-block-status.util";

const MAX_DISCOVERY_BLOCKS_PER_PROJECT = 20;

@Injectable()
export class DiscoveryBlocksService {
  // explicit constructor form, kept for learning purposes in this module -
  // strictly equivalent to the usual shorthand
  // `constructor(private readonly prisma: PrismaService, private readonly projectsService: ProjectsService) {}`
  // (that shorthand is the standard form to use elsewhere in the codebase)
  prisma: PrismaService;
  projectsService: ProjectsService;
  realtimeService: RealtimeService;
  constructor(
    prisma: PrismaService,
    projectsService: ProjectsService,
    realtimeService: RealtimeService
  ) {
    this.prisma = prisma;
    this.projectsService = projectsService;
    this.realtimeService = realtimeService;
    // teaches the gateway how to resolve a "discovery-block:<id>" key's
    // real projectId, so it can validate a field:lock/unlock/query without
    // this service's model leaking into realtime.gateway.ts
    this.realtimeService.registerKeyPrefixValidator(
      "discovery-block",
      async (id) => {
        const block = await this.prisma.discoveryBlock.findUnique({
          where: { id },
          select: { projectId: true },
        });
        return block?.projectId;
      }
    );
  }

  // GET (all)
  async findAll(projectId: string, userId: string) {
    // shared guard (see ProjectsService.assertMembership) - throws NotFoundException
    // if the project doesn't exist or userId isn't a member of it
    await this.projectsService.assertMembership(projectId, userId);

    // retrieve the discovery blocks after the ownership test passed.
    // orderBy is not optional here: without it, Postgres makes no ordering
    // guarantee at all for a plain SELECT, and an UPDATE (ex: editing a
    // block's color) can visibly change the order rows come back in on the
    // next findMany
    const blocks = await this.prisma.discoveryBlock.findMany({
      where: {
        projectId: projectId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return blocks;
  }

  // POST
  async create(
    projectId: string,
    dto: CreateDiscoveryBlockDto,
    userId: string
  ) {
    await this.projectsService.assertMembership(projectId, userId);

    // count-then-create is a TOCTOU race in general (two concurrent requests
    // could both read a count under the cap, then both insert) - wrapped in
    // a Serializable transaction so Postgres itself rejects the second
    // transaction if it would have read stale data
    const block = await this.prisma.transaction(
      async (transactionPrisma) => {
        const existingBlockCount = await transactionPrisma.discoveryBlock.count(
          {
            where: { projectId: projectId },
          }
        );
        if (existingBlockCount >= MAX_DISCOVERY_BLOCKS_PER_PROJECT) {
          throw new BadRequestException(
            `A project can have at most ${MAX_DISCOVERY_BLOCKS_PER_PROJECT} discovery blocks`
          );
        }

        return transactionPrisma.discoveryBlock.create({
          data: {
            title: dto.title,
            description: dto.description,
            icon: dto.icon,
            color: dto.color,
            notes: dto.notes,
            projectId: projectId, // does not comes from the dto but from the url !
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    this.realtimeService.emitToProject(
      projectId,
      "discovery-block:created",
      block
    );
    return block;
  }

  // GET (one)
  // also reused by update/remove as their access guard: it already checks both
  // "is userId a member of projectId" and "does this id belong to projectId",
  // and throws the right NotFoundException in each case
  async findById(projectId: string, id: string, userId: string) {
    await this.projectsService.assertMembership(projectId, userId);

    const block = await this.prisma.discoveryBlock.findFirst({
      where: { id: id, projectId: projectId },
    });
    if (!block) {
      throw new NotFoundException("Discovery block not found");
    }
    return block;
  }

  // Recomputes and persists this block's status from its own checklist -
  // called by DiscoveryBlockItemsService after every item create/update/remove,
  // never by this service's own update() (status is never sent in that DTO,
  // see its own comment). The actual rule lives in computeDiscoveryBlockStatus,
  // also used by seed.ts so seeded data can never drift from it.
  //
  // read-then-write is a TOCTOU race like create()'s cap check above - two
  // near-simultaneous toggles on the same block (two tabs, two teammates)
  // could otherwise interleave and leave `status` reflecting neither
  // toggle's final state. Same Serializable-transaction fix, so Postgres
  // rejects whichever transaction read stale data instead of letting it commit.
  async recalculateStatus(discoveryBlockId: string): Promise<void> {
    const updatedBlock = await this.prisma.transaction(
      async (transactionPrisma) => {
        const items = await transactionPrisma.discoveryBlockItem.findMany({
          where: { discoveryBlockId: discoveryBlockId },
          select: { isChecked: true },
        });

        return transactionPrisma.discoveryBlock.update({
          where: { id: discoveryBlockId },
          data: { status: computeDiscoveryBlockStatus(items) },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    // without this, checking a block's last item silently updates its
    // status in the DB with no live signal - the Discovery overview page
    // only listens for discovery-block:updated to know when to move a
    // block between its NOT_STARTED/IN_PROGRESS/COMPLETED sections
    this.realtimeService.emitToProject(
      updatedBlock.projectId,
      "discovery-block:updated",
      updatedBlock
    );
  }

  // PATCH (partial update)
  async update(
    projectId: string,
    id: string,
    dto: UpdateDiscoveryBlockDto,
    userId: string,
    fieldLockToken: string | undefined
  ) {
    let updatedBlock;
    try {
      updatedBlock = await this.realtimeService.withValidatedFieldLock(
        projectId,
        `discovery-block:${id}`,
        userId,
        fieldLockToken,
        async () => {
          await this.findById(projectId, id, userId);
        },
        async () =>
          this.prisma.discoveryBlock.update({
            where: { id: id },
            data: { ...dto },
          })
      );
    } catch (error) {
      if (error instanceof FieldLockLeaseError) {
        throw new ForbiddenException(
          "A current editing lease is required to update this category"
        );
      }
      // someone else deleted this block in the race window between the
      // guard above and this update - a clean 404 instead of Prisma's raw
      // "record to update not found" text leaking to the client
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException("Discovery block not found");
      }
      throw error;
    }
    this.realtimeService.emitToProject(
      projectId,
      "discovery-block:updated",
      updatedBlock
    );
    return updatedBlock;
  }

  // DELETE
  // discoveryBlockItems cascade-delete automatically at the DB level
  // (onDelete: Cascade on DiscoveryBlockItem.discoveryBlock in schema.prisma) - no need to delete them here
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
        `discovery-block:${id}`,
        async () => {
          this.realtimeService.assertFieldLockOwnerIfLocked(
            `discovery-block:${id}`,
            userId,
            fieldLockToken
          );
          const existingBlock = await this.findById(projectId, id, userId);
          let deletedBlock = existingBlock;
          try {
            deletedBlock = await this.prisma.discoveryBlock.delete({
              where: { id: id },
            });
          } catch (error) {
            if (!isRecordNotFoundError(error)) {
              throw error;
            }
          }
          return {
            deletedBlock,
            released: this.realtimeService.releaseFieldLockForResource(
              `discovery-block:${id}`
            ),
          };
        }
      );
    } catch (error) {
      if (error instanceof FieldLockLeaseError) {
        throw new ForbiddenException(
          "This category is currently being edited by someone else"
        );
      }
      throw error;
    }
    if (result.released !== undefined) {
      this.realtimeService.emitFieldUnlock(result.released);
    }
    this.realtimeService.emitToProject(
      projectId,
      "discovery-block:deleted",
      result.deletedBlock
    );
    return result.deletedBlock;
  }
}
