import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { RelationshipStatus } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService, StoredObject } from "../storage/storage.service";
import { RealtimeService } from "../realtime/realtime.service";
import { UpdateUserDto } from "./dto/update-user.dto";

const USER_NOT_FOUND_ERR_MSG = "User not found";

// Matches the exact shape uploadAvatar generates below
// (avatar-{userId}-{uuid}-{safeOriginalName}, where safeOriginalName is
// reduced to [A-Za-z0-9._-] by replacing other characters with "_").
// getAvatar's :key param is otherwise handed straight
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

const SAFE_PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  campus: true,
} as const;

function throwIfBadRequest(key: string) {
  if (!AVATAR_KEY_PATTERN.test(key) || key.includes("..")) {
    throw new BadRequestException("Invalid avatar key");
  }
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly realtimeService: RealtimeService
  ) {}

  async findMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND_ERR_MSG);
    }
    return user;
  }

  // viewerId is who's asking, not just who's being looked up - a block must
  // stay unobservable from the blocked side (same rule
  // UserRelationshipsService's create()/update() enforce for the
  // relationship status itself: deriveFriendshipStatus on the frontend keeps
  // showing the blocker as a normal ACCEPTED friend to the person they
  // blocked). Without checking here too, that same blocked viewer would
  // still see the blocker's real online/offline state on every profile
  // fetch, which is exactly the tell the status-hiding was meant to prevent.
  // Optional (self-lookups from uploadAvatar/removeAvatar below, and
  // UserRelationshipsService's own username-only lookups, have no distinct
  // viewer to check against) - skipped whenever there isn't one, or when
  // looking up your own profile.
  async findById(id: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_PUBLIC_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND_ERR_MSG);
    }
    const blockedByTarget =
      viewerId !== undefined &&
      viewerId !== id &&
      (await this.prisma.userRelationship.findUnique({
        where: {
          requesterId_addresseeId: {
            requesterId: id,
            addresseeId: viewerId,
          },
          status: RelationshipStatus.BLOCKED,
        },
      })) !== null;
    // Not a stored column - computed fresh from whether this user currently
    // has a live socket (see RealtimeService.isUserOnline), so it's never
    // stale the way a cached "lastSeen" column would be between requests.
    return {
      ...user,
      online: blockedByTarget ? false : this.realtimeService.isUserOnline(id),
    };
  }

  async update(userId: string, dto: UpdateUserDto) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto },
      select: SAFE_USER_SELECT,
    });
  }

  async remove(userId: string) {
    // There's no ownership-transfer flow yet (TR-91), so an OWNER's project
    // has no one to fall back to if we let this through - even a project
    // where they're the sole member would be left behind ownerless (its
    // ProjectMember row cascades away with the user, but the Project row
    // itself doesn't), not deleted, and not reachable through any UI.
    const ownsProject = await this.prisma.projectMember.findFirst({
      where: { userId, role: "OWNER" },
    });
    if (ownsProject) {
      throw new ConflictException(
        "Cannot delete account while you own a project. Transfer ownership first."
      );
    }

    return await this.prisma.user.delete({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
  }

  // --- Avatar ---

  async getAvatar(key: string): Promise<StoredObject> {
    throwIfBadRequest(key);
    const bucket = this.config.getOrThrow<string>("RUSTFS_BUCKET");
    return await this.storage.getObject(bucket, key);
  }

  // Every upload gets a fresh key (userId + uuid) rather than overwriting a
  // fixed slot per user - simpler, but it means the previous avatar object
  // is left behind in storage instead of being deleted.
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
    contentType: string
  ) {
    const user = await this.findById(userId);

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
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: `/api/users/avatar/${key}` },
      select: SAFE_USER_SELECT,
    });

    const previousKey = user.avatarUrl?.split("/").pop();
    if (previousKey) {
      await this.storage.deleteObject(bucket, previousKey);
    }

    return updated;
  }

  async removeAvatar(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    const key = user.avatarUrl?.split("/").pop();
    if (!key) {
      return true;
    }
    throwIfBadRequest(key);

    // Clear the DB reference first: if the storage delete below fails, the
    // user is left with no avatar (falls back to initials) instead of a
    // dangling avatarUrl pointing at an object that may or may not exist.
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: SAFE_USER_SELECT,
    });

    const bucket = this.config.getOrThrow<string>("RUSTFS_BUCKET");
    await this.storage.deleteObject(bucket, key);
    return true;
  }
}
