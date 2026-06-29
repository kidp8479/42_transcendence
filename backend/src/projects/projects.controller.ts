import { Controller } from "@nestjs/common";
import { Controller } from "@nestjs/common";
// this class will eventually contain the endpoint methods
// like:
// @Get()
// findAll() {} etc..
@Controller("projects") // tells Nest this class handles requests whos route starts with /projects
export class ProjectsController {}
