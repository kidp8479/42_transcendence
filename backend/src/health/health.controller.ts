import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { VaultRuntimeService } from "../vault/vault-runtime.service";

@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly vaultRuntime: VaultRuntimeService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  async getHealth(): Promise<{ status: "ok" }> {
    if (!this.vaultRuntime.isReady()) {
      throw new ServiceUnavailableException({ status: "unavailable" });
    }
    try {
      await this.prisma.ping();
    } catch {
      throw new ServiceUnavailableException({ status: "unavailable" });
    }
    return { status: "ok" };
  }
}
