// RustfsTestModule: throwaway module used only to prove the RustFS pipeline
// works end-to-end (browser -> backend -> RustFS -> backend -> browser).
// Not part of any real feature yet - safe to delete once the real
// avatar/attachment feature is built on top of StorageModule directly.

import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { RustfsTestController } from "./rustfs-test.controller";

@Module({
  imports: [StorageModule],
  controllers: [RustfsTestController],
})
export class RustfsTestModule {}
