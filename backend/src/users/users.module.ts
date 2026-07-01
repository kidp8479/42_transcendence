// UsersModule: registers the controller and service for the users feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Module({
  controllers: [UsersController], // handles HTTP requests
  providers: [UsersService], // handles database operations
  exports: [UsersService], // expose UsersService to other modules that may need it
})
export class UsersModule {}
