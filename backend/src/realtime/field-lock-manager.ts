import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { randomUUID, timingSafeEqual } from "node:crypto";

export interface FieldLock {
  userId: string;
  username: string;
  avatarUrl: string | null;
  projectId: string;
  socketId: string;
  expiresAt: number;
}

interface FieldLockLease extends FieldLock {
  token: string;
}

interface AcquireFieldLockInput {
  key: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  projectId: string;
  socketId: string;
}

export interface AcquireFieldLockResult {
  acquired: boolean;
  lock: FieldLock | undefined;
  token: string | undefined;
}

export class FieldLockLeaseError extends Error {
  constructor() {
    super("The field lock is no longer valid");
  }
}

export interface ReleasedFieldLock {
  key: string;
  lock: FieldLock;
}

const FIELD_LOCK_TTL_MS = 30_000;
const FIELD_LOCK_EXPIRY_CHECK_INTERVAL_MS = 5_000;

@Injectable()
export class FieldLockManager implements OnModuleDestroy {
  private readonly leases = new Map<string, FieldLockLease>();
  private readonly coordinator = new KeyedCoordinator();
  private expirationHandler:
    ((released: ReleasedFieldLock) => void) | undefined;
  private readonly expiryTimer = setInterval(() => {
    void this.releaseExpiredLeases();
  }, FIELD_LOCK_EXPIRY_CHECK_INTERVAL_MS);

  constructor() {
    this.expiryTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.expiryTimer);
  }

  setExpirationHandler(handler: (released: ReleasedFieldLock) => void): void {
    this.expirationHandler = handler;
  }

  async withProject<T>(
    projectId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.coordinator.run([projectKey(projectId)], operation);
  }

  async withProjectResource<T>(
    projectId: string,
    resourceKey: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.coordinator.run(
      [projectKey(projectId), resourceCoordinatorKey(resourceKey)],
      operation
    );
  }

  acquire(input: AcquireFieldLockInput): AcquireFieldLockResult {
    this.releaseIfExpired(input.key);
    const existing = this.leases.get(input.key);
    if (existing !== undefined && existing.socketId !== input.socketId) {
      return {
        acquired: false,
        lock: toPublicLock(existing),
        token: undefined,
      };
    }

    if (existing !== undefined) {
      existing.expiresAt = Date.now() + FIELD_LOCK_TTL_MS;
      return {
        acquired: true,
        lock: toPublicLock(existing),
        token: existing.token,
      };
    }

    const lease: FieldLockLease = {
      ...input,
      token: randomUUID(),
      expiresAt: Date.now() + FIELD_LOCK_TTL_MS,
    };
    this.leases.set(input.key, lease);
    return { acquired: true, lock: toPublicLock(lease), token: lease.token };
  }

  renew(key: string, socketId: string, token: string): FieldLock | undefined {
    const lease = this.leases.get(key);
    if (
      lease === undefined ||
      lease.socketId !== socketId ||
      !tokensMatch(lease.token, token)
    ) {
      return undefined;
    }
    if (lease.expiresAt <= Date.now()) {
      const released = this.releaseResource(key);
      if (released !== undefined) {
        this.expirationHandler?.(released);
      }
      return undefined;
    }

    lease.expiresAt = Date.now() + FIELD_LOCK_TTL_MS;
    return toPublicLock(lease);
  }

  get(key: string): FieldLock | undefined {
    this.releaseIfExpired(key);
    const lease = this.leases.get(key);
    return lease === undefined ? undefined : toPublicLock(lease);
  }

  release(key: string, socketId: string): ReleasedFieldLock | undefined {
    const lease = this.leases.get(key);
    if (lease === undefined || lease.socketId !== socketId) {
      return undefined;
    }

    this.leases.delete(key);
    return { key, lock: toPublicLock(lease) };
  }

  releaseResource(key: string): ReleasedFieldLock | undefined {
    const lease = this.leases.get(key);
    if (lease === undefined) {
      return undefined;
    }

    this.leases.delete(key);
    return { key, lock: toPublicLock(lease) };
  }

  releaseUserInProject(userId: string, projectId: string): ReleasedFieldLock[] {
    const released: ReleasedFieldLock[] = [];
    for (const [key, lease] of this.leases) {
      if (lease.userId === userId && lease.projectId === projectId) {
        this.leases.delete(key);
        released.push({ key, lock: toPublicLock(lease) });
      }
    }
    return released;
  }

  async releaseSocket(socketId: string): Promise<ReleasedFieldLock[]> {
    const leases = [...this.leases.entries()].filter(
      ([, lease]) => lease.socketId === socketId
    );
    const released: ReleasedFieldLock[] = [];
    for (const [key, lease] of leases) {
      const result = await this.withProjectResource(
        lease.projectId,
        key,
        async () => this.release(key, socketId)
      );
      if (result !== undefined) {
        released.push(result);
      }
    }
    return released;
  }

  async withValidatedLease<T>(
    projectId: string,
    key: string,
    userId: string,
    token: string | undefined,
    authorize: () => Promise<void>,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.withProjectResource(projectId, key, async () => {
      const lease = this.leases.get(key);
      if (
        lease === undefined ||
        lease.userId !== userId ||
        lease.projectId !== projectId ||
        token === undefined ||
        !tokensMatch(lease.token, token) ||
        lease.expiresAt <= Date.now()
      ) {
        if (lease !== undefined && lease.expiresAt <= Date.now()) {
          const released = this.releaseResource(key);
          if (released !== undefined) {
            this.expirationHandler?.(released);
          }
        }
        throw new FieldLockLeaseError();
      }

      await authorize();

      const currentLease = this.leases.get(key);
      if (
        currentLease === undefined ||
        !tokensMatch(currentLease.token, token) ||
        currentLease.expiresAt <= Date.now()
      ) {
        throw new FieldLockLeaseError();
      }

      return operation();
    });
  }

  assertLeaseOwnerIfLocked(
    key: string,
    userId: string,
    token: string | undefined
  ): void {
    const lease = this.leases.get(key);
    if (lease === undefined) {
      return;
    }
    if (this.releaseIfExpired(key)) {
      return;
    }
    if (
      lease.userId !== userId ||
      token === undefined ||
      !tokensMatch(lease.token, token)
    ) {
      throw new FieldLockLeaseError();
    }
  }

  private async releaseExpiredLeases(): Promise<void> {
    const now = Date.now();
    const expired = [...this.leases.entries()].filter(
      ([, lease]) => lease.expiresAt <= now
    );
    for (const [key, lease] of expired) {
      const released = await this.withProjectResource(
        lease.projectId,
        key,
        async () => {
          const currentLease = this.leases.get(key);
          if (
            currentLease === undefined ||
            currentLease.expiresAt > Date.now()
          ) {
            return undefined;
          }
          return this.releaseResource(key);
        }
      );
      if (released !== undefined) {
        this.expirationHandler?.(released);
      }
    }
  }

  private releaseIfExpired(key: string): boolean {
    const lease = this.leases.get(key);
    if (lease === undefined || lease.expiresAt > Date.now()) {
      return false;
    }
    const released = this.releaseResource(key);
    if (released !== undefined) {
      this.expirationHandler?.(released);
    }
    return true;
  }
}

class KeyedCoordinator {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(keys: string[], operation: () => Promise<T>): Promise<T> {
    const orderedKeys = [...new Set(keys)].sort();
    const releases: (() => void)[] = [];
    try {
      for (const key of orderedKeys) {
        releases.push(await this.acquire(key));
      }
      return await operation();
    } finally {
      for (const release of releases.reverse()) {
        release();
      }
    }
  }

  private async acquire(key: string): Promise<() => void> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let releaseCurrent: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(key, tail);
    await previous;

    return () => {
      releaseCurrent!();
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    };
  }
}

function projectKey(projectId: string): string {
  return `project:${projectId}`;
}

function resourceCoordinatorKey(resourceKey: string): string {
  return `resource:${resourceKey}`;
}

function toPublicLock(lease: FieldLockLease): FieldLock {
  return {
    userId: lease.userId,
    username: lease.username,
    avatarUrl: lease.avatarUrl,
    projectId: lease.projectId,
    socketId: lease.socketId,
    expiresAt: lease.expiresAt,
  };
}

function tokensMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
