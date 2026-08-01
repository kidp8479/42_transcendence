import { Injectable } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToProject(projectId: string, event: string, payload: unknown): void {
    this.gateway.server.to(`project:${projectId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.gateway.server.to(`user:${userId}`).emit(event, payload);
  }

  isLockedByOther(key: string, userId: string): boolean {
    return this.gateway.isLockedByOtherUser(key, userId);
  }

  // lets each owning module teach the gateway how to resolve one of its own
  // models from a key prefix, instead of the gateway hardcoding a branch per
  // domain model - see the gateway's own keyBelongsToProject.
  registerKeyPrefixValidator(
    prefix: string,
    validator: (id: string) => Promise<string | undefined>
  ): void {
    this.gateway.registerKeyPrefixValidator(prefix, validator);
  }

  // call when a lockable resource is deleted, so a lock nobody will ever
  // release (the resource is gone, findById would now 404) doesn't linger
  // in the gateway's Map until its holder happens to disconnect
  forceReleaseLock(key: string): void {
    this.gateway.forceReleaseLock(key);
  }

  // handleConnection only joins project rooms from a snapshot taken at
  // connect time - a user added to a project while already connected (an
  // open tab) never gets joined to that project's room otherwise, and
  // misses every broadcast for it until they reconnect. socketsJoin finds
  // every socket already in the user's own room and adds the new one,
  // without this service needing to hold socket references itself.
  joinProjectRoom(userId: string, projectId: string): void {
    this.gateway.server
      .in(`user:${userId}`)
      .socketsJoin(`project:${projectId}`);
  }

  // symmetric to joinProjectRoom - a removed member's already-open tab would
  // otherwise keep receiving that project's broadcasts (checklist/discovery
  // updates, notifications) until they reconnect
  leaveProjectRoom(userId: string, projectId: string): void {
    this.gateway.server
      .in(`user:${userId}`)
      .socketsLeave(`project:${projectId}`);
  }
}
