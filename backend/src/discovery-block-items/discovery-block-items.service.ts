// DiscoveryBlockItemsService: handles all database operations for DiscoveryBlockItems
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DiscoveryBlocksService } from "../discovery-blocks/discovery-blocks.service";
import { CreateDiscoveryBlockItemDto } from "./dto/create-discovery-block-item.dto";
import { UpdateDiscoveryBlockItemDto } from "./dto/update-discovery-block-item.dto";

@Injectable()
export class DiscoveryBlockItemsService {
  prisma: PrismaService;
  discoveryBlocksService: DiscoveryBlocksService;
  constructor(
    prisma: PrismaService,
    discoveryBlocksService: DiscoveryBlocksService
  ) {
    this.prisma = prisma;
    this.discoveryBlocksService = discoveryBlocksService;
  }

  // GET (all)
  async findAll(projectId: string, discoveryBlockId: string, userId: string) {
    // guard, reuses the one from discoveryBlocksService, will check membership and project ownership in one call
    await this.discoveryBlocksService.findById(
      projectId,
      discoveryBlockId,
      userId
    );
    // where you really retrieve what you want after the guard check
    const blockItems = await this.prisma.discoveryBlockItem.findMany({
      where: { discoveryBlockId: discoveryBlockId },
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

    const blockItem = await this.prisma.discoveryBlockItem.create({
      data: {
        label: dto.label,
        order: dto.order,
        discoveryBlockId: discoveryBlockId, // does not comes from the dto but from the url !
      },
    });
    return blockItem;
  }

  // GET (one)
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
    return deletedItem;
  }
}
