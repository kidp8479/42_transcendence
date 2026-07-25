import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { VaultRuntimeService } from "../vault/vault-runtime.service";

const poolDrainTimeoutMs = 30_000;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client?: PrismaClient;
  private unregisterDatabaseRefresher?: () => void;
  private readonly drainTimers = new Set<NodeJS.Timeout>();

  constructor(private readonly vaultRuntime: VaultRuntimeService) {}

  get user(): PrismaClient["user"] {
    return this.currentClient().user;
  }

  get project(): PrismaClient["project"] {
    return this.currentClient().project;
  }

  get projectMember(): PrismaClient["projectMember"] {
    return this.currentClient().projectMember;
  }

  get evaluationChecklistItem(): PrismaClient["evaluationChecklistItem"] {
    return this.currentClient().evaluationChecklistItem;
  }

  get discoveryBlock(): PrismaClient["discoveryBlock"] {
    return this.currentClient().discoveryBlock;
  }

  get discoveryBlockItem(): PrismaClient["discoveryBlockItem"] {
    return this.currentClient().discoveryBlockItem;
  }

  async onModuleInit(): Promise<void> {
    const credentials = await this.vaultRuntime.start();
    await this.replaceClient(this.vaultRuntime.databaseUrl(credentials));
    this.unregisterDatabaseRefresher =
      this.vaultRuntime.registerDatabaseRefresher(async (nextCredentials) => {
        await this.replaceClient(
          this.vaultRuntime.databaseUrl(nextCredentials)
        );
      });
  }

  async onModuleDestroy(): Promise<void> {
    this.unregisterDatabaseRefresher?.();
    for (const timer of this.drainTimers) {
      clearTimeout(timer);
    }
    await this.client?.$disconnect();
  }

  private currentClient(): PrismaClient {
    if (!this.client) {
      throw new Error("Prisma client is unavailable");
    }
    return this.client;
  }

  private async replaceClient(databaseUrl: string): Promise<void> {
    const nextClient = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    try {
      await nextClient.$connect();
    } catch (error) {
      await nextClient.$disconnect();
      throw error;
    }

    const previousClient = this.client;
    this.client = nextClient;
    if (previousClient) {
      const timer = setTimeout(() => {
        this.drainTimers.delete(timer);
        void previousClient.$disconnect();
      }, poolDrainTimeoutMs);
      this.drainTimers.add(timer);
    }
  }
}
