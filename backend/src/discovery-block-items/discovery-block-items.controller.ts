// DiscoveryBlockItemsController: handles all HTTP requests under /api/discovery-block-items
// one method per route - delegates all database work to DiscoveryBlockItemsService

import { Controller } from "@nestjs/common";

@Controller("discovery-block-items")
export class DiscoveryBlockItemsController {
  // TODO: inject DiscoveryBlockItemsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/discovery-block-items
  //        => create a new item inside a discovery block
  //        => expects a request body matching CreateDiscoveryBlockItemDto (discoveryBlockId, label, order)
  // GET    /api/discovery-block-items
  //        => get all items belonging to a discovery block
  //        => expects ?discoveryBlockId=... as a URL query param (no request body, no DTO)
  // GET    /api/discovery-block-items/:id
  //        => get one item by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/discovery-block-items/:id
  //        => update an existing item (label or isChecked)
  //        => expects a request body matching UpdateDiscoveryBlockItemDto (all fields optional)
  // DELETE /api/discovery-block-items/:id
  //        => delete an item by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
