// StorageModule: wraps the S3-compatible RustFS client behind StorageService
// so any future feature (avatars, attachments, ...) can just import this
// module instead of talking to the S3 SDK directly.

import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";

@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
