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
const SAME_STATUS_ERR_MSG = "relationship already has this status";

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

  // A row the caller doesn't own is the other side's stance; a block on it
  // must read exactly like the relationship did before the block, so it
  // never becomes observable from the blocked side (see the same invariant
  // in create()'s comment and users.service.ts's blockedByTarget checks).
  private maskCounterpartBlocks<
    T extends { requesterId: string; status: RelationshipStatus },
  >(rows: T[], callerId: string): T[] {
    return rows.map((row) =>
      row.requesterId !== callerId && row.status === RelationshipStatus.BLOCKED
        ? { ...row, status: RelationshipStatus.ACCEPTED }
        : row
    );
  }

  async findAll(userId: string) {
    const rows = await this.prisma.userRelationship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });
    return this.maskCounterpartBlocks(rows, userId);
  }

  async findById(addresseeId: string, requesterId: string) {
    // A relationship with oneself can never exist; short-circuit instead of
    // hitting the database for a query guaranteed to return nothing.
    if (requesterId === addresseeId) {
      return [];
    }

    const rows = await this.prisma.userRelationship.findMany({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });
    return this.maskCounterpartBlocks(rows, requesterId);
  }

  async create(addresseeId: string, requesterId: string) {
    throwIfAllEqual(
      [requesterId, addresseeId],
      ForbiddenException,
      BOTH_ID_EQUAL_ERR_MSG
    );

    await this.userService.findById(addresseeId);

    // Set inside the transaction when the addressee has blocked thethrowIfA
    // requester - the transaction still returns normally (so the caller
    // sees the same success response as a real request, per the
    // block-must-stay-unobservable-from-the-requester's-side invariant
    // below), but nothing was written, so the notification/realtime step
    // after the transaction must not run either.
    let blocked = false;

    const created = await this.prisma.transaction(
      async (database) => {
        const fromRequester = await database.userRelationship.findFirst({
          where: {
            requesterId: requesterId,
            addresseeId: addresseeId,
          },
        });
        if (fromRequester?.status === RelationshipStatus.BLOCKED) {
          throw new ForbiddenException(EXISTING_RELATION_ERR_MSG);
        }

        const fromAddressee = await database.userRelationship.findFirst({
          where: {
            requesterId: addresseeId,
            addresseeId: requesterId,
          },
        });
        // Any pre-existing row from the addressee - pending, accepted, or
        // blocked - is treated identically: a plain conflict, no
        // status-specific message. This is deliberate for two reasons: a
        // user blocked by the addressee gets the exact same response as a
        // plain duplicate request (so a block is never observable from the
        // requester's side), and an addressee row can outlive the
        // requester's own (remove() excludes BLOCKED rows from deletion,
        // see its own comment) - if that survivor later gets unblocked, it
        // becomes a lone ACCEPTED/PENDING_APPROVAL row with no counterpart.
        // Without this check, a fresh create() from the other side would
        // silently create an ACCEPTED row here (below) instead of going
        // through a real accept.
        switch (fromAddressee?.status) {
          case RelationshipStatus.ACCEPTED:
            throw new ForbiddenException(EXISTING_RELATION_ERR_MSG);

          case RelationshipStatus.BLOCKED:
            blocked = true;
            return [requesterId, addresseeId];

          default:
            if (!fromRequester) {
              await database.userRelationship.create({
                data: {
                  requesterId: requesterId,
                  addresseeId: addresseeId,
                  status: RelationshipStatus.ACCEPTED,
                },
              });
            }
            // fromAddressee is always null here - the check above already threw
            // otherwise.
            if (!fromAddressee) {
              await database.userRelationship.create({
                data: {
                  requesterId: addresseeId,
                  addresseeId: requesterId,
                  status: RelationshipStatus.PENDING_APPROVAL,
                },
              });
            }
            return [requesterId, addresseeId];
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
    // Send Requester data through WebSockets - skipped when the addressee
    // has blocked the requester: nothing was written above, and notifying
    // the blocker of an invitation they'll never see the effect of is
    // exactly the tell the BLOCKED case above was meant to suppress.
    if (!blocked) {
      // The relationship is already committed above; a failed notification
      // must not turn a successful request into a 500.
      try {
        const requester = await this.userService.findById(requesterId);
        await this.notificationService.create(
          addresseeId,
          requester.username + " wants to be your friend!",
          `/friends?userId=${requesterId}`
        );
        this.realtimeService.emitToUser(
          addresseeId,
          "friends:request-received",
          requesterId
        );
      } catch (error) {
        console.error("friend request notification failed", error);
      }
    }
    return created;
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

    // Captured from inside the transaction below - needed after it resolves,
    // for the notification check past the transaction's own return.
    let currentStatus: RelationshipStatus | undefined;

    const updated = await this.prisma.transaction(
      async (database) => {
        // requesterId here is always the caller (see the controller), so
        // this can only ever match the caller's own directional row - the
        // other side's row is never reachable through this query, and
        // therefore never editable by the caller. Read through `database`
        // (the transaction's own client), not a plain `this.prisma` call
        // made before the transaction opens - a pre-transaction read lets
        // two concurrent PATCHes on the same row (double-click Accept, two
        // open tabs) both validate against the same stale snapshot and both
        // proceed into their own transaction; whichever commits second then
        // hits a raw Prisma conflict instead of the intended, readable
        // ForbiddenException/NotFoundException. Reading here means the
        // second transaction re-validates against what the first one
        // actually committed.
        const currentRelationship = await database.userRelationship.findUnique({
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
            return await database.userRelationship.create({
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

        currentStatus = currentRelationship.status;

        // Reject no-op updates (same status requested twice).
        throwIfAllEqual(
          [dto.status, currentStatus],
          ForbiddenException,
          SAME_STATUS_ERR_MSG
        );

        // PENDING_APPROVAL is only ever a starting state, produced by
        // create(). It is never a valid PATCH target, so this is the only
        // transition rule needed on top of the no-op check above: every
        // other transition (accept, block from either state, unblock) is
        // allowed.
        if (
          currentStatus !== RelationshipStatus.PENDING_APPROVAL &&
          dto.status === RelationshipStatus.PENDING_APPROVAL
        ) {
          throw new ForbiddenException(INVALID_STATUS_SEQUENCE_ERR_MSG);
        }

        // Unblocking is the one transition that can't be a plain status
        // flip: remove() deliberately excludes BLOCKED rows from deletion
        // (so unfriending someone never lifts a block as a side effect),
        // which means the counterpart row can already be gone by the time
        // this row gets unblocked. Resurrecting this row as ACCEPTED in
        // that case would fabricate a one-sided "friendship" the other
        // side never agreed to (and that later poisons create() - see its
        // own comment on fromAddressee). If there's nothing left on the
        // other side to be ACCEPTED with, unblocking just deletes this row
        // too, landing back on the same NONE state the other side is
        // already in.
        if (
          currentStatus === RelationshipStatus.BLOCKED &&
          dto.status !== RelationshipStatus.BLOCKED
        ) {
          const counterpart = await database.userRelationship.findFirst({
            where: {
              requesterId: addresseeId,
              addresseeId: requesterId,
            },
          });
          if (!counterpart) {
            return await database.userRelationship.delete({
              where: {
                requesterId_addresseeId: {
                  requesterId: requesterId,
                  addresseeId: addresseeId,
                },
              },
            });
          }
        }

        return await database.userRelationship.update({
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
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
    // Inform addressee that request has been approved. The relationship is
    // already committed above; a failed notification must not turn a
    // successful request into a 500.
    if (
      currentStatus === RelationshipStatus.PENDING_APPROVAL &&
      dto.status === RelationshipStatus.ACCEPTED
    ) {
      try {
        const requester = await this.userService.findById(requesterId);
        await this.notificationService.create(
          addresseeId,
          requester.username + " is now your friend!",
          `/friends?userId=${requesterId}`
        );
        this.realtimeService.emitToUser(
          addresseeId,
          "friends:request-accepted",
          updated
        );
      } catch (error) {
        console.error("friend acceptance notification failed", error);
      }
    }
    return updated;
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
        await database.userRelationship.deleteMany({
          where: {
            requesterId: requesterId,
            addresseeId: addresseeId,
            status: { not: RelationshipStatus.BLOCKED },
          },
        });

        await database.userRelationship.deleteMany({
          where: {
            requesterId: addresseeId,
            addresseeId: requesterId,
            status: { not: RelationshipStatus.BLOCKED },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  }
}
