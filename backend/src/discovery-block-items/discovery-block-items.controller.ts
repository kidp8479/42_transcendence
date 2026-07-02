// DiscoveryBlockItemsController: handles all HTTP requests under /api/discovery-blocks/:discoveryBlockId/items
// one method per route - delegates all database work to DiscoveryBlockItemsService
// note: discoveryBlockId always comes from the URL, never from the request body

import { Controller } from "@nestjs/common";

@Controller("discovery-blocks/:discoveryBlockId/items")
export class DiscoveryBlockItemsController {
  // TODO: inject DiscoveryBlockItemsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/discovery-blocks/:discoveryBlockId/items
  //        => create a new item inside a discovery block
  //        => expects a request body matching CreateDiscoveryBlockItemDto (label, order)
  //        => discoveryBlockId comes from the URL, not the body
  // GET    /api/discovery-blocks/:discoveryBlockId/items
  //        => get all items belonging to a discovery block
  //        => :discoveryBlockId is a placeholder filled by the frontend (no request body, no DTO)
  // GET    /api/discovery-blocks/:discoveryBlockId/items/:id
  //        => get one item by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/discovery-blocks/:discoveryBlockId/items/:id
  //        => update an existing item (label or isChecked)
  //        => expects a request body matching UpdateDiscoveryBlockItemDto (all fields optional)
  // DELETE /api/discovery-blocks/:discoveryBlockId/items/:id
  //        => delete an item by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)
}
