// DiscoveryBlocksController: handles all HTTP requests under /api/discovery-blocks
// one method per route - delegates all database work to DiscoveryBlocksService

import { Controller } from "@nestjs/common";

@Controller("discovery-blocks")
export class DiscoveryBlocksController {
  // TODO: inject DiscoveryBlocksService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/discovery-blocks
  //        => create a new discovery block
  //        => expects a request body matching CreateDiscoveryBlockDto (projectId, title, description?, icon?, color?, notes?)
  // GET    /api/discovery-blocks
  //        => get all discovery blocks for a project
  //        => expects ?projectId=... as a URL query param (no request body, no DTO)
  // GET    /api/discovery-blocks/:id
  //        => get one discovery block by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/discovery-blocks/:id
  //        => update an existing discovery block (title, description, or notes)
  //        => expects a request body matching UpdateDiscoveryBlockDto (all fields optional)
  // DELETE /api/discovery-blocks/:id
  //        => delete a discovery block by its id
  //        => no request body needed, the id in the URL is enough (no DTO)
}
