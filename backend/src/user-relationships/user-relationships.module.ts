import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UserRelationshipsController } from "./user-relationships.controller";
import { UserRelationshipsService } from "./user-relationships.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [RealtimeModule, NotificationsModule, UsersModule],
  controllers: [UserRelationshipsController],
  providers: [UserRelationshipsService],
  exports: [UserRelationshipsService],
})
export class UserRelationshipsModule {}
