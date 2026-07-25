import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { VaultRuntimeService } from "../vault/vault-runtime.service";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly vaultRuntime: VaultRuntimeService) {}

  @Get()
  getHealth(): { status: "ok" } {
    if (!this.vaultRuntime.isReady()) {
      throw new ServiceUnavailableException("Vault runtime is unavailable");
    }
    return { status: "ok" };
  }
}
