// SearchController: the single route behind the header search bar,
// GET /api/search?q=... (main.ts sets the "api" prefix globally, so the
// @Controller path is "search" and not "api/search").
//
// No @UseGuards: authentication is three global APP_GUARDs declared in
// app.module.ts (ThrottlerGuard -> VaultReadinessGuard -> AuthGuard), so this
// route is protected the moment the module is registered. Opting out would take
// an explicit @Public(), which this route must never have - every result it
// returns is scoped to the caller.
//
// The userId comes from request.user, filled by AuthGuard from the introspected
// access token, and never from the query string. That is the whole point: a
// caller-supplied id would let anyone search another account's projects.
//
// No response shaping here, as everywhere else in this codebase - the controller
// returns the service's result untouched.

import { Controller, Get, Query, Req } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchQueryDto } from "./dto/search-query.dto";
import type { AuthenticatedRequest } from "../auth/authenticated-request";

@Controller("search")
export class SearchController {
  // injected by NestJS at startup, never constructed by hand
  constructor(private readonly searchService: SearchService) {}

  // GET /api/search?q=&type=&sort=&order=&page=&limit=&status=&includeArchived=
  //    => matching projects, tasks and users, each with its own total
  //    => every parameter is validated by SearchQueryDto; the global
  //       ValidationPipe rejects any query key that isn't declared there
  @Get()
  search(@Query() query: SearchQueryDto, @Req() request: AuthenticatedRequest) {
    return this.searchService.search(query, request.user.id);
  }
}
