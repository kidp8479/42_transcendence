// DiscoveryBlocksService: handles all database operations for DiscoveryBlocks
// called by the controller, never called directly by the frontend

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DiscoveryBlocksService {
  // explicit constructor form kept on purpose (not "private readonly") while learning
  // will factor to the shorthand once the whole service is written
  prisma: PrismaService;
  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  async findAll(projectId: string, userId: string) {
    // guard clause: verifies userId is a member of projectId before anything else runs.
    // without this, any authenticated user could read another project's discovery blocks
    // just by guessing/changing :projectId in the URL (IDOR) - see controller header comment
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        members: { some: { userId: userId } },
      },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    // retrieve the discovery blocks after the ownership test passed
    const blocks = await this.prisma.discoveryBlock.findMany({
      where: {
        projectId: projectId,
      },
    });
    return blocks;
  }

  // TODO: create(projectId: string, dto: CreateDiscoveryBlockDto, userId: string)
  //       => must throw (ex: NotFoundException) if userId is not a ProjectMember of projectId
  //       => insert a new discovery block in the database, linked to projectId from the URL

  // TODO: findById(id: string, userId: string)
  //       => must throw if userId is not a ProjectMember of this block's project
  //       => fetch one discovery block by its id
  // TODO: update(id: string, dto: UpdateDiscoveryBlockDto, userId: string)
  //       => same membership check as findById
  //       => update an existing block (title, description, or notes)
  //       => status is recalculated automatically, never updated directly
  // TODO: remove(id: string, userId: string)
  //       => same membership check as findById
  //       => permanently delete a discovery block and its items
}
