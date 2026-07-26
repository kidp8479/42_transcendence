// DiscoveryBlocksService: handles all database operations for DiscoveryBlocks
// called by the controller, never called directly by the frontend

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { CreateDiscoveryBlockDto } from "./dto/create-discovery-block.dto";
import { UpdateDiscoveryBlockDto } from "./dto/update-discovery-block.dto";

// named constant so the limit is easy to find/change in one place (per
// Christophe/Andrei's feedback on Carlos's PR #18: don't bury a cap as a bare
// number in the middle of the method, and don't be too stingy with it either)
const MAX_DISCOVERY_BLOCKS_PER_PROJECT = 20;

@Injectable()
export class DiscoveryBlocksService {
  // explicit constructor form, kept for learning purposes in this module -
  // strictly equivalent to the usual shorthand
  // `constructor(private readonly prisma: PrismaService, private readonly projectsService: ProjectsService) {}`
  // (that shorthand is the standard form to use elsewhere in the codebase)
  prisma: PrismaService;
  projectsService: ProjectsService;
  constructor(prisma: PrismaService, projectsService: ProjectsService) {
    this.prisma = prisma;
    this.projectsService = projectsService;
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
    // next findMany - a real bug hit while testing the color/icon selector.
    // No dedicated `order` field on DiscoveryBlock (unlike DiscoveryBlockItem,
    // which has one), so createdAt is the next best stable ordering.
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
    // transaction if it would have read stale data, same fix Christophe
    // proposed for the equivalent bug on ProjectsService.create() (PR #18)
    const block = await this.prisma.$transaction(
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

  // PATCH (partial update)
  // status is never set here - can't calculate it automatically until
  // DiscoveryBlockItem (the checklist) is implemented, see the DTO's own comment
  async update(
    projectId: string,
    id: string,
    dto: UpdateDiscoveryBlockDto,
    userId: string
  ) {
    await this.findById(projectId, id, userId); // access guard, see findById's own comment

    // { ...dto } (spread notation in js) only contains the fields actually sent by the client (PATCH is partial):
    // Prisma's update() only touches the keys present in `data`, leaving the rest of the row untouched
    const updatedBlock = await this.prisma.discoveryBlock.update({
      where: { id: id },
      data: { ...dto },
    });
    return updatedBlock;
  }

  // DELETE
  // discoveryBlockItems cascade-delete automatically at the DB level
  // (onDelete: Cascade on DiscoveryBlockItem.discoveryBlock in schema.prisma) - no need to delete them here
  async remove(projectId: string, id: string, userId: string) {
    await this.findById(projectId, id, userId); // access guard, see findById's own comment
    const deletedBlock = await this.prisma.discoveryBlock.delete({
      where: { id: id },
    });
    return deletedBlock;
  }
}
