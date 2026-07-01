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
  // TODO: create(dto: CreateDiscoveryBlockDto)
  //       => insert a new discovery block in the database
  // TODO: findAll(projectId: string)
  //       => fetch all discovery blocks belonging to a given project
  // TODO: findById(id: string)
  //       => fetch one discovery block by its id
  // TODO: update(id: string, dto: UpdateDiscoveryBlockDto)
  //       => update an existing block (title, description, or notes)
  //       => status is recalculated automatically, never updated directly
  // TODO: remove(id: string)
  //       => permanently delete a discovery block and its items
}
