// RustfsTestController: throwaway upload/download endpoints to manually
// verify RustFS connectivity from the browser. Not project-scoped (nothing
// here belongs to a project/task/event), just requires an authenticated
// session like every other route (global AuthGuard, no @Public()).

import {
  Controller,
  Get,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
// tsconfig restricts automatic @types inclusion to "node" only, so
// @types/multer's global Express.Multer.File augmentation needs an explicit
// import to be picked up by the compiler.
import "multer";
import { ApiSecurity } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { StorageService } from "../storage/storage.service";

const MAX_TEST_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller("rustfs-test")
export class RustfsTestController {
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService
  ) {}

  @ApiSecurity("csrf")
  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_TEST_UPLOAD_BYTES } })
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    const bucket = this.config.getOrThrow<string>("RUSTFS_BUCKET");
    // No "/" in the key: keeps the download route a plain single :key param
    // instead of needing wildcard route syntax.
    const key = `${randomUUID()}-${file.originalname}`;
    await this.storage.uploadObject(bucket, key, file.buffer, file.mimetype);
    return { bucket, key, size: file.size };
  }

  @Get(":key")
  async download(@Param("key") key: string): Promise<StreamableFile> {
    const bucket = this.config.getOrThrow<string>("RUSTFS_BUCKET");
    const { body, contentType } = await this.storage.getObject(bucket, key);
    return new StreamableFile(body, { type: contentType });
  }
}
