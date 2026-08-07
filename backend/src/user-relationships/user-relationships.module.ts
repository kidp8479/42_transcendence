import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UserRelationshipsController } from "./user-relationships.controller";
import { UserRelationshipsService } from "./user-relationships.service";

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [UserRelationshipsController],
  providers: [UserRelationshipsService],
  exports: [UserRelationshipsService],
})
export class UserRelationshipsModule {}
