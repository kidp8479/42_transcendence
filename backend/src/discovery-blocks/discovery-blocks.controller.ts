// DiscoveryBlocksController: handles all HTTP requests under /api/projects/:projectId/discovery-blocks
// one method per route - delegates all database work to DiscoveryBlocksService
// note: projectId always comes from the URL, never from the request body

import { Controller } from "@nestjs/common";

@Controller("projects/:projectId/discovery-blocks")
export class DiscoveryBlocksController {
  // TODO: inject DiscoveryBlocksService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects/:projectId/discovery-blocks
  //        => create a new discovery block
  //        => expects a request body matching CreateDiscoveryBlockDto (title, description?, icon?, color?, notes?)
  //        => projectId comes from the URL, not the body
  // GET    /api/projects/:projectId/discovery-blocks
  //        => get all discovery blocks for a project
  //        => :projectId is a placeholder filled by the frontend (no request body, no DTO)
  // GET    /api/projects/:projectId/discovery-blocks/:id
  //        => get one discovery block by its id
  //        => :id is a placeholder filled by the frontend (no request body, no DTO)
  // PATCH  /api/projects/:projectId/discovery-blocks/:id
  //        => update an existing discovery block (title, description, or notes)
  //        => expects a request body matching UpdateDiscoveryBlockDto (all fields optional)
  // DELETE /api/projects/:projectId/discovery-blocks/:id
  //        => delete a discovery block by its id
  //        => no request body needed, the ids in the URL are enough (no DTO)
}
