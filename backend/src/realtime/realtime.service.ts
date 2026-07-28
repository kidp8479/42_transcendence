import { Injectable } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToProject(projectId: string, event: string, payload: unknown): void {
    this.gateway.server.to(`project:${projectId}`).emit(event, payload);
  }
}
