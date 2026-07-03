// DiscoveryBlockItemsController: handles all HTTP requests under /api/projects/:projectId/discovery-blocks/:discoveryBlockId/items
// one method per route - delegates all database work to DiscoveryBlockItemsService
// note: projectId and discoveryBlockId always come from the URL, never from the request body
// note: when implementing, validate :projectId, :discoveryBlockId and :id with @Param(name, ParseUUIDPipe)
// so a malformed id gets rejected with a 400 before hitting the database

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/discovery-blocks/:discoveryBlockId/items")
export class DiscoveryBlockItemsController {
  // TODO: inject DiscoveryBlockItemsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/discovery-blocks/:discoveryBlockId/items
  //        => create a new item inside a discovery block
  //        => expects a request body matching CreateDiscoveryBlockItemDto (label, order)
  //        => projectId and discoveryBlockId come from the URL, not the body
  // GET    /api/projects/:projectId/discovery-blocks/:discoveryBlockId/items
  //        => get all items belonging to a discovery block
  // GET    /api/projects/:projectId/discovery-blocks/:discoveryBlockId/items/:id
  //        => get one item by its id
  // PATCH  /api/projects/:projectId/discovery-blocks/:discoveryBlockId/items/:id
  //        => update an existing item (label or isChecked)
  //        => expects a request body matching UpdateDiscoveryBlockItemDto (all fields optional)
  // DELETE /api/projects/:projectId/discovery-blocks/:discoveryBlockId/items/:id
  //        => delete an item by its id
}
