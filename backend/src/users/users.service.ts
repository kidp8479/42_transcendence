import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService, StoredObject } from "../storage/storage.service";
// import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

// Matches the exact shape uploadAvatar generates below
// (avatar-{userId}-{uuid}-{safeOriginalName}, safeOriginalName having only
// "\" and "/" stripped). getAvatar's :key param is otherwise handed straight
// to S3's GetObjectCommand - Express only percent-decodes it after route
// matching, so an unvalidated key could smuggle "%2F" (-> "/") or ".."
// through to the storage layer. StorageService is a generic bucket wrapper,
// not avatar-specific, so this is the only thing keeping this endpoint
// scoped to avatar objects instead of "any object in the bucket".
const AVATAR_KEY_PATTERN = /^avatar-[^/\\]+$/;

// Shared with update()/remove() below so their response shape matches
// findById()/GET /users/me instead of leaking the raw Prisma row (status,
// globalRole, ...) - also means a future column added to User doesn't get
// silently exposed through these endpoints without an explicit opt-in here.
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  emailVerified: true,
  username: true,
  avatarUrl: true,
  campus: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async update(userId: string, dto: UpdateUserDto) {
    // will throw if user doesn't exist
    await this.findById(userId);

    return await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto },
      select: SAFE_USER_SELECT,
    });
  }

  async remove(userId: string) {
    await this.findById(userId);

    return await this.prisma.user.delete({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
  }

  // Every upload gets a fresh key (userId + uuid) rather than overwriting a
  // fixed slot per user - simpler, but it means the previous avatar object
  // is left behind in storage instead of being deleted.
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
    contentType: string
  ) {
    await this.findById(userId);

    const bucket = this.config.getOrThrow<string>("RUSTFS_BUCKET");
    // Restricted to a charset that's always safe unescaped in a URL path
    // segment. Anything wider (spaces, "%", "#", "?", ...) would land
    // unencoded in avatarUrl below and either get silently truncated by the
    // browser (#, ?) or, for a stray "%" followed by non-hex characters,
    // make Express's decodeURIComponent throw on every subsequent GET of
    // that exact URL - permanently breaking the avatar until re-upload.
    const safeOriginalName = file.originalname
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/\.\.+/g, "_");
    const key = `avatar-${userId}-${randomUUID()}-${safeOriginalName}`;
    // contentType is the sniffed mimetype (see detectImageMimetype), not
    // file.mimetype - what gets stored here is what downloadAvatar serves
    // back verbatim, so it must never be the client-declared header.
    await this.storage.uploadObject(bucket, key, file.buffer, contentType);

    // avatarUrl is what the frontend actually reads/renders - stored as the
    // route it can hit directly, not the raw storage key.
    return await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: `/api/users/avatar/${key}` },
      select: SAFE_USER_SELECT,
    });
  }

  async getAvatar(key: string): Promise<StoredObject> {
    if (!AVATAR_KEY_PATTERN.test(key) || key.includes("..")) {
      throw new BadRequestException("Invalid avatar key");
    }
    const bucket = this.config.getOrThrow<string>("RUSTFS_BUCKET");
    return await this.storage.getObject(bucket, key);
  }
}
