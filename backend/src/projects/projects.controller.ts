import { Controller } from "@nestjs/common";
// this class will eventually contain the endpoint methods
// like:
// @Get()
// findAll() {} etc..
@Controller("projects") // tells Nest this class handles requests whos route starts with /projects
export class ProjectsController {
  // TODO: inject ProjectsService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // POST   /api/projects
  //        => create a new project
  //        => expects CreateProjectDto (name, description?, status?, deadline?, isArchived?)
  // GET    /api/projects
  //        => get all projects for the current user
  //        => future: pagination, filtering (status, archived)
  // GET    /api/projects/:id
  //        => get one project by id
  //        => :id is provided by the frontend via URL param
  // PATCH  /api/projects/:id
  //        => update an existing project
  //        => expects UpdateProjectDto (all fields optional)
  // DELETE /api/projects/:id
  //        => delete a project by id
  //        => no request body required
  // FUTURE IMPROVEMENTS:
  // - PATCH /projects/:id/archive -> archive/unarchive project
  // - GET /projects?status=REVIEW -> filter by status
  // - GET /projects?archived=true -> filter archived projects
  // - add pagination (limit, offset or cursor-based)
  // - add auth guards (only project members can access)
}
