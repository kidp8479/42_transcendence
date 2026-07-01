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
  // TODO: create(dto: CreateDiscoveryBlockItemDto)
  //       => insert a new item in the database
  // TODO: findAll(discoveryBlockId: string)
  //       => fetch all items belonging to a given discovery block
  // TODO: findById(id: string)
  //       => fetch one item by its id
  // TODO: update(id: string, dto: UpdateDiscoveryBlockItemDto)
  //       => update an existing item (label or isChecked)
  // TODO: remove(id: string)
  //       => permanently delete an item
}
