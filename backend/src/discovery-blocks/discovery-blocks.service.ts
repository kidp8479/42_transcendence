// DiscoveryBlocksService: handles all database operations for DiscoveryBlocks
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDiscoveryBlockDto } from "./dto/create-discovery-block.dto";
import { UpdateDiscoveryBlockDto } from "./dto/update-discovery-block.dto";

@Injectable()
export class DiscoveryBlocksService {
  // explicit constructor form, kept for learning purposes in this module -
  // strictly equivalent to the usual shorthand `constructor(private readonly prisma: PrismaService) {}`
  // (that shorthand is the standard form to use elsewhere in the codebase)
  prisma: PrismaService;
  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  // helper
  // guard clause: verifies userId is a member of projectId before anything else runs.
  // without this, any authenticated user could read another project's discovery blocks
  // just by guessing/changing :projectId in the URL (IDOR) - see controller header comment
  private async assertProjectMembership(
    projectId: string,
    userId: string
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        members: { some: { userId: userId } },
      },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
  }

  // GET (all)
  async findAll(projectId: string, userId: string) {
    await this.assertProjectMembership(projectId, userId);

    // retrieve the discovery blocks after the ownership test passed
    const blocks = await this.prisma.discoveryBlock.findMany({
      where: {
        projectId: projectId,
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
    await this.assertProjectMembership(projectId, userId);

    const block = await this.prisma.discoveryBlock.create({
      data: {
        title: dto.title,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        notes: dto.notes,
        projectId: projectId,
      },
    });
    return block;
  }

  // GET (one)
  // also reused by update/remove as their access guard: it already checks both
  // "is userId a member of projectId" and "does this id belong to projectId",
  // and throws the right NotFoundException in each case
  async findById(projectId: string, id: string, userId: string) {
    await this.assertProjectMembership(projectId, userId);

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
