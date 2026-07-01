// UsersService: handles all database operations for users
// called by the controller, never called directly by the frontend
import { Injectable } from "@nestjs/common";

// @Injectable(): tells NestJS this class can be shared with other classes (like the controller)
// without it, NestJS cannot inject this service into the constructor of another class
@Injectable()
export class UsersService {
  // code your logic here
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(dto: CreateUserDto)
  //       => insert a new user in the database (called by the auth team, not the frontend)
  // TODO: findById(id: string)
  //       => fetch one user by their id
  // TODO: update(id: string, dto: UpdateUserDto)
  //       => update username, email, or avatarUrl
  // TODO: remove(id: string)
  //       => permanently delete a user account
}
