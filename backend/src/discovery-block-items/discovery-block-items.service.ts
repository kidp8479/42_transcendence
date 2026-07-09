// DiscoveryBlockItemsService: handles all database operations for DiscoveryBlockItems
// called by the controller, never called directly by the frontend
import { Injectable } from "@nestjs/common";

@Injectable()
export class DiscoveryBlockItemsService {
  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(projectId: string, discoveryBlockId: string, dto: CreateDiscoveryBlockItemDto, userId: string)
  //       => must throw (ex: NotFoundException) if userId is not a ProjectMember of projectId,
  //          or if discoveryBlockId does not actually belong to projectId
  //       => insert a new item in the database, linked to discoveryBlockId from the URL
  // TODO: findAll(projectId: string, discoveryBlockId: string, userId: string)
  //       => same checks as create
  //       => fetch all items belonging to a given discovery block
  // TODO: findById(id: string, projectId: string, userId: string)
  //       => must throw if userId is not a ProjectMember of projectId, or if this item's
  //          discovery block does not belong to projectId
  //       => fetch one item by its id
  // TODO: update(id: string, dto: UpdateDiscoveryBlockItemDto, projectId: string, userId: string)
  //       => same membership/ownership check as findById
  //       => update an existing item (label or isChecked)
  // TODO: remove(id: string, projectId: string, userId: string)
  //       => same membership/ownership check as findById
  //       => permanently delete an item
}
