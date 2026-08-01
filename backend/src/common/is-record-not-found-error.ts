import { Prisma } from "@prisma/client";

// True for Prisma's P2025 ("record to update/delete/connect doesn't exist").
// Used by remove() methods to treat "someone else already deleted this" as
// success instead of surfacing Prisma's raw error text - two members
// deleting the same row within the same race window both want the same end
// state (the row gone), so the second delete isn't really a failure.
export function isRecordNotFoundError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
