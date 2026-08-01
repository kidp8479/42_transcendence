import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService, StoredObject } from "../storage/storage.service";
// import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

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
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        avatarUrl: true,
        campus: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
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
    });
  }

  async remove(userId: string) {
    await this.findById(userId);

    return await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    await this.findById(userId);

    const bucket = this.config.getOrThrow<string>("RUSTFS_BUCKET");
    // Slash-free so download stays a plain :key route param, and prefixed
    // with the user id so an object leak can't be replayed against another
    // account's avatar slot.
    const safeOriginalName = file.originalname.replace(/[\\/]/g, "_");
    const key = `avatar-${userId}-${randomUUID()}-${safeOriginalName}`;
    await this.storage.uploadObject(bucket, key, file.buffer, file.mimetype);

    return await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: `/api/users/avatar/${key}` },
    });
  }

  async getAvatar(key: string): Promise<StoredObject> {
    const bucket = this.config.getOrThrow<string>("RUSTFS_BUCKET");
    return await this.storage.getObject(bucket, key);
  }
}
