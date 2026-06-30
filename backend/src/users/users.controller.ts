// UsersController: handles all HTTP requests under /api/users
// one method per route - delegates all database work to UsersService

import { Controller } from "@nestjs/common";

@Controller("users")
export class UsersController {
  // TODO: inject UsersService here via constructor
  // TODO: GET /users/me - return the profile of the currently logged-in user (needs authguard)
  // TODO: GET /users/:id - return the profile of any user by id
  // TODO: PATCH /users/me - update the current user's profile (needs auth guard)
  // TODO: DELETE /users/me - permanently delete the current user's account (needs auth guard)
  // WARNING: 'me' routes must be declared BEFORE ':id' routes
  // otherwise Express (http motor for nestjs) will treat the word "me" as an id
}
