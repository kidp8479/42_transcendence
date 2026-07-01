// UsersController: handles all HTTP requests under /api/users
// one method per route - delegates all database work to UsersService

import { Controller } from "@nestjs/common";

@Controller("users")
export class UsersController {
  // TODO: inject UsersService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // ENDPOINTS:
  // WARNING: 'me' routes must be declared BEFORE ':id' routes
  //          otherwise Express treats the word "me" as an id and matches the wrong route
  // GET    /api/users/me
  //        => return the profile of the currently logged-in user
  //        => needs auth guard (user must be logged in) - no request body, no DTO
  // GET    /api/users/:id
  //        => return the public profile of any user by their id
  //        => :id is a placeholder filled by the frontend - no request body, no DTO
  // PATCH  /api/users/me
  //        => update the current user's own profile (username, email, avatarUrl)
  //        => needs auth guard - expects a request body matching UpdateUserDto (all fields optional)
  // DELETE /api/users/me
  //        => permanently delete the current user's own account
  //        => needs auth guard - no request body needed, no DTO
}
