import { Global, Module } from "@nestjs/common";
import { VaultRuntimeService } from "./vault-runtime.service";

@Global()
@Module({
  providers: [VaultRuntimeService],
  exports: [VaultRuntimeService],
})
export class VaultModule {}
