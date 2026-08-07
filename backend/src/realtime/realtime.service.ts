import { Injectable } from "@nestjs/common";
import { FieldLockManager, ReleasedFieldLock } from "./field-lock-manager";
import { RealtimeGateway } from "./realtime.gateway";

@Injectable()
export class RealtimeService {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly fieldLockManager: FieldLockManager
  ) {}

  emitToProject(projectId: string, event: string, payload: unknown): void {
    this.gateway.server.to(`project:${projectId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.gateway.server.to(`user:${userId}`).emit(event, payload);
  }

  // A user is "online" iff they have at least one live socket in their
  // personal room - the same room emitToUser targets, joined in
  // RealtimeGateway.joinRooms. No separate presence state is tracked here;
  // this just reads what Socket.IO's adapter already knows (a room is
  // dropped the moment its last socket leaves it, so a plain `.has()` is
  // enough - no need to also check the member count).
  isUserOnline(userId: string): boolean {
    return this.gateway.server.sockets.adapter.rooms.has(`user:${userId}`);
  }

  async withValidatedFieldLock<T>(
    projectId: string,
    key: string,
    userId: string,
    token: string | undefined,
    authorize: () => Promise<void>,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.fieldLockManager.withValidatedLease(
      projectId,
      key,
      userId,
      token,
      authorize,
      operation
    );
  }

  async withProjectFieldLock<T>(
    projectId: string,
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.fieldLockManager.withProjectResource(projectId, key, operation);
  }

  async withProjectLock<T>(
    projectId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.fieldLockManager.withProject(projectId, operation);
  }

  assertFieldLockOwnerIfLocked(
    projectId: string,
    key: string,
    userId: string,
    token: string | undefined
  ): void {
    this.fieldLockManager.assertLeaseOwnerIfLocked(
      projectId,
      key,
      userId,
      token
    );
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
  // in the lock manager until its holder happens to disconnect
  releaseFieldLockForResource(key: string): ReleasedFieldLock | undefined {
    return this.fieldLockManager.releaseResource(key);
  }

  // call when a member is removed from a project, so any lock they held
  // there doesn't outlive their membership - see the gateway's own comment
  releaseFieldLocksForUserInProject(
    userId: string,
    projectId: string
  ): ReleasedFieldLock[] {
    return this.fieldLockManager.releaseUserInProject(userId, projectId);
  }

  emitFieldUnlock(released: ReleasedFieldLock): void {
    this.gateway.emitFieldUnlock(released);
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
