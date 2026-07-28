// RealtimeModule: registers the RealtimeGateway (WebSocket connections) for the app
// NestJS will not know it exists until it is declared here
import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";

@Module({
  controllers: [],
  providers: [RealtimeGateway],
  exports: [],
})
export class RealtimeModule {}
