// DiscoveryBlocksService: handles all database operations for DiscoveryBlocks
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDiscoveryBlockDto } from "./dto/create-discovery-block.dto";

@Injectable()
export class DiscoveryBlocksService {
  // explicit constructor form kept on purpose (not "private readonly" this time) while learning
  // will factor to the shorthand once the whole service is written
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

  // GET
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

  // TODO: findById(id: string, userId: string) => GET
  //       => must throw if userId is not a ProjectMember of this block's project
  //       => fetch one discovery block by its id
  // TODO: update(id: string, dto: UpdateDiscoveryBlockDto, userId: string) => PATCH
  //       => same membership check as findById
  //       => update an existing block (title, description, or notes)
  //       => status is recalculated automatically, never updated directly
  // TODO: remove(id: string, userId: string) => DELETE
  //       => same membership check as findById
  //       => permanently delete a discovery block and its items
}
