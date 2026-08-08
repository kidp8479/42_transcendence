// UsersModule: registers the controller and service for the users feature
// NestJS will not know they exist until they are declared here
import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [StorageModule, RealtimeModule], // avatar upload/download goes through StorageService; RealtimeModule powers findById's online status
  controllers: [UsersController], // handles HTTP requests
  providers: [UsersService], // handles database operations
  exports: [UsersService], // expose UsersService to other modules that may need it
})
export class UsersModule {}
