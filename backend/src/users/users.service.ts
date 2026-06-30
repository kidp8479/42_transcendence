// UsersService: handles all database operations for users
// called by the controller, never called directly by the frontend
import { Injectable } from "@nestjs/common";

// @Injectable(): tells NestJS this class can be shared with other classes (like the controller)
// without it, NestJS cannot inject this service into the constructor of another class
@Injectable()
export class UsersService {
  // exemple of actions to code here in the service.ts file of a module
  // TODO: inject PrismaService here via constructor
  // TODO: create(dto: CreateUserDto) insert a new user in the database (called by auth team)
  // TODO: findById(id: string) fetch one user by id
  // TODO: update(id: string, dto: UpdateUserDto) update username, email, or avatarUrl
  // TODO: remove(id: string) permanently delete a user account
}
