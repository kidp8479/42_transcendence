import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { VaultRuntimeService } from "../vault/vault-runtime.service";

type HealthStatus = { status: "ok" };

@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly vaultRuntime: VaultRuntimeService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  @Get()
  async getHealth(): Promise<HealthStatus> {
    if (!this.vaultRuntime.isReady()) {
      this.unavailable();
    }
    try {
      await this.prisma.ping();
    } catch {
      this.unavailable();
    }
    return { status: "ok" };
  }

  @Get("storage")
  async getStorageHealth(): Promise<HealthStatus> {
    if (!this.vaultRuntime.isReady()) {
      this.unavailable();
    }
    try {
      await Promise.all([this.prisma.ping(), this.storage.ping()]);
    } catch {
      this.unavailable();
    }
    return { status: "ok" };
  }

  private unavailable(): never {
    throw new ServiceUnavailableException({ status: "unavailable" });
  }
}
