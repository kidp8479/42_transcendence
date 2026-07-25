import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { VaultRuntimeService } from "../vault/vault-runtime.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class VaultReadinessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly vaultRuntime: VaultRuntimeService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || this.vaultRuntime.isReady()) {
      return true;
    }
    throw new ServiceUnavailableException("Vault runtime is unavailable");
  }
}
