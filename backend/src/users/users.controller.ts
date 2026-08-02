import {
  Body,
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  StreamableFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
// tsconfig restricts automatic @types inclusion to "node" only, so
// @types/multer's global Express.Multer.File augmentation needs an explicit
// import to be picked up by the compiler.
import "multer";
import { ApiSecurity } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { detectImageMimetype } from "../common/detect-image-type";
import { UsersService } from "./users.service";
// import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  findMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findById(request.user.id);
  }

  @ApiSecurity("csrf")
  @Patch("me")
  update(@Body() dto: UpdateUserDto, @Req() request: AuthenticatedRequest) {
    return this.usersService.update(request.user.id, dto);
  }

  @ApiSecurity("csrf")
  @Delete("me")
  remove(@Req() request: AuthenticatedRequest) {
    return this.usersService.remove(request.user.id);
  }

  // --- Avatar ---
  // Multipart upload, so it can't go through UpdateUserDto/class-validator
  // like the rest of the profile - the file is checked by hand below, and
  // the resulting object key/URL is computed in the service.

  @ApiSecurity("csrf")
  @Post("me/avatar")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_AVATAR_BYTES } })
  )
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: AuthenticatedRequest
  ) {
    if (!file) {
      throw new BadRequestException("A file is required");
    }
    // file.mimetype is the client-declared Content-Type of the multipart
    // part - not trustworthy on its own (see detectImageMimetype's comment).
    // Sniffing the real bytes and only accepting a small raster allowlist is
    // what actually decides the stored/served Content-Type.
    const detectedMimetype = detectImageMimetype(file.buffer);
    if (detectedMimetype === undefined) {
      throw new BadRequestException("Avatar must be a PNG, JPEG, GIF image");
    }
    return this.usersService.uploadAvatar(
      request.user.id,
      file,
      detectedMimetype
    );
  }

  // Public to any logged-in user, not just the owner: avatars are displayed
  // all over the app (project members, calendar events...), so this has to
  // be readable for whoever the avatar belongs to.
  @Get("avatar/:key")
  async downloadAvatar(@Param("key") key: string): Promise<StreamableFile> {
    const { body, contentType } = await this.usersService.getAvatar(key);
    return new StreamableFile(body, { type: contentType });
  }
}
