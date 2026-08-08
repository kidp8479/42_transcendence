import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateUserRelationshipDto } from "./dto/update-user-relationship.dto";
import { RealtimeService } from "../realtime/realtime.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RelationshipStatus } from "@prisma/client";
import { throwIfAllEqual } from "../common/throwIf";
import { UsersService } from "../users/users.service";

const UNKNOWN_USER_ERR_MSG = "unknown user";
const EXISTING_RELATION_ERR_MSG = "relationship already exists";
const BOTH_ID_EQUAL_ERR_MSG = "requesterId and addresseeId are equal";
const INVALID_STATUS_SEQUENCE_ERR_MSG = "Invalid status sequence";

// A relationship between two users is stored as TWO directional rows, one per
// participant (requesterId -> addresseeId each way). Each row represents that
// participant's own stance (pending / accepted / blocked) and is only ever
// writable by its own requester. This is what lets each side change their own
// status (accept, block, unblock) without needing permission checks beyond
// "does this row belong to the caller".
@Injectable()
export class UserRelationshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly notificationService: NotificationsService,
    private readonly userService: UsersService
  ) {}

  async findAll(userId: string) {
    return await this.prisma.userRelationship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });
  }

  async findById(addresseeId: string, requesterId: string) {
    // A relationship with oneself can never exist; short-circuit instead of
    // hitting the database for a query guaranteed to return nothing.
    if (requesterId === addresseeId) {
      return [];
    }

    return await this.prisma.userRelationship.findMany({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });
  }

  async create(addresseeId: string, requesterId: string) {
    throwIfAllEqual(
      [requesterId, addresseeId],
      ForbiddenException,
      BOTH_ID_EQUAL_ERR_MSG
    );

    return this.prisma.transaction(
      async (database) => {
        const fromRequester = await database.userRelationship.findFirst({
          where: {
            requesterId: requesterId,
            addresseeId: addresseeId,
          },
        });
        const fromAddressee = await database.userRelationship.findFirst({
          where: {
            requesterId: addresseeId,
            addresseeId: requesterId,
          },
        });

        // Any pre-existing row on either side - pending, accepted, or blocked -
        // is treated identically: a plain conflict, no status-specific message.
        // This is deliberate: a user blocked by the addressee gets the exact
        // same response as a plain duplicate request, so a block is never
        // observable from the requester's side.
        if ((fromRequester && fromAddressee) || fromAddressee?.status === RelationshipStatus.BLOCKED) {
          throw new ForbiddenException(EXISTING_RELATION_ERR_MSG);
        }

        if (!fromRequester) {
          await database.userRelationship.create({
            data: {
              requesterId: requesterId,
              addresseeId: addresseeId,
              status: RelationshipStatus.ACCEPTED,
            },
          });
        }

        if (!fromAddressee) {
          await database.userRelationship.create({
            data: {
              requesterId: addresseeId,
              addresseeId: requesterId,
              status: RelationshipStatus.PENDING_APPROVAL,
            },
          });
          // Send Requester data through WebSockets
          const requester = await this.userService.findById(requesterId);
          this.notificationService.create(
            addresseeId,
            requester.username + " wants to be your friend!",
            `/friends?userId=${requesterId}`
          );
          this.realtimeService.emitToUser(
            addresseeId,
            "friends:request-received",
            requesterId
          );
        }
        return [requesterId, addresseeId];
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  }

  async update(
    addresseeId: string,
    dto: UpdateUserRelationshipDto,
    requesterId: string
  ) {
    throwIfAllEqual(
      [requesterId, addresseeId],
      ForbiddenException,
      BOTH_ID_EQUAL_ERR_MSG
    );

    // requesterId here is always the caller (see the controller), so this can
    // only ever match the caller's own directional row - the other side's row
    // is never reachable through this query, and therefore never editable by
    // the caller.
    const currentRelationship = await this.prisma.userRelationship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId,
          addresseeId,
        },
      },
    });
    if (!currentRelationship) {
      // Blocking requests are always taken into account even if no prior relationship
      if (dto.status === RelationshipStatus.BLOCKED) {
        return await this.prisma.userRelationship.create({
          data: {
            requesterId: requesterId,
            addresseeId: addresseeId,
            status: dto.status,
          },
        });
      } else {
        throw new NotFoundException(UNKNOWN_USER_ERR_MSG);
      }
    }

    const currentStatus = currentRelationship.status;

    // Reject no-op updates (same status requested twice).
    throwIfAllEqual(
      [dto.status, currentStatus],
      ForbiddenException,
      BOTH_ID_EQUAL_ERR_MSG
    );

    // PENDING_APPROVAL is only ever a starting state, produced by create().
    // It is never a valid PATCH target, so this is the only transition rule
    // needed on top of the no-op check above: every other transition
    // (accept, block from either state, unblock) is allowed.
    if (
      currentStatus !== RelationshipStatus.PENDING_APPROVAL &&
      dto.status === RelationshipStatus.PENDING_APPROVAL
    ) {
      throw new ForbiddenException(INVALID_STATUS_SEQUENCE_ERR_MSG);
    }

    return await this.prisma.transaction(
      async (database) => {
        const updated = await database.userRelationship.update({
          where: {
            requesterId_addresseeId: {
              requesterId: requesterId,
              addresseeId: addresseeId,
            },
          },
          data: {
            status: dto.status,
          },
        });
        // Inform addressee that request has been approved
        if (dto.status === RelationshipStatus.ACCEPTED) {
          const requester = await this.userService.findById(requesterId);
          this.notificationService.create(
            addresseeId,
            requester.username + " is now your friend!",
            `/friends?userId=${requesterId}`
          );
          this.realtimeService.emitToUser(
            addresseeId,
            "friends:request-accepted",
            updated
          );
        }
        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  }

  async remove(addresseeId: string, requesterId: string) {
    throwIfAllEqual(
      [requesterId, addresseeId],
      ForbiddenException,
      BOTH_ID_EQUAL_ERR_MSG
    );

    return this.prisma.transaction(
      async (database) => {
        // BLOCKED rows are excluded on purpose: removing a relationship must
        // not lift a block as a side effect. deleteMany() (rather than
        // delete()) is used because a non-matching row - i.e. one that is
        // currently blocked - should silently no-op instead of throwing.
        const mine = await database.userRelationship.deleteMany({
          where: {
            requesterId: requesterId,
            addresseeId: addresseeId,
            status: { not: RelationshipStatus.BLOCKED },
          },
        });

        const theirs = await database.userRelationship.deleteMany({
          where: {
            requesterId: addresseeId,
            addresseeId: requesterId,
            status: { not: RelationshipStatus.BLOCKED },
          },
        });

        // Unlike create()/update(), this has no block-visibility concern - a
        // no-op against a blocked row never reaches here (excluded above), so
        // whatever this notifies about was always something the other side
        // could already see (a pending request or a settled friendship).
        // Tells them live: a friend request they sent/received was
        // declined/cancelled, or a friendship was ended - without this, their
        // page keeps showing the stale relationship until they reload it.
        if (mine.count > 0 || theirs.count > 0) {
          this.realtimeService.emitToUser(
            addresseeId,
            "friends:relationship-removed",
            requesterId
          );
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  }
}
