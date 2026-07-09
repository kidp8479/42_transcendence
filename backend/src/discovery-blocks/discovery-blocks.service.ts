// DiscoveryBlocksService: handles all database operations for DiscoveryBlocks
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class DiscoveryBlocksService {
  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(projectId: string, dto: CreateDiscoveryBlockDto, userId: string)
  //       => must throw (ex: NotFoundException) if userId is not a ProjectMember of projectId
  //       => insert a new discovery block in the database, linked to projectId from the URL
  // TODO: findAll(projectId: string, userId: string)
  //       => must throw if userId is not a ProjectMember of projectId
  //       => fetch all discovery blocks belonging to a given project
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
