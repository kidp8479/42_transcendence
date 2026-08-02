// This file avoids shorthand JS/TS forms (object shorthand, destructuring,
// spread) on purpose, while learning - explicit forms only, ex: `{ id: id }`
// instead of `{ id }`, `const id = value.id` instead of `const { id } = value`.
// Same equivalent meaning, just spelled out for now.
import { apiClient } from "@/lib/apiClient";

export type DiscoveryBlockStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

// shared pill style for anything showing a DiscoveryBlockStatus (the status
// counters at the top of discovery.tsx, and the per-card badge in
// DiscoveryBlockCard.tsx) - built from the app's own status-* tokens
// (index.css), not Flowbite's Badge colors, to get the thin-border/
// translucent-fill look Figma uses (see TaskStatusOverview.tsx). Kept in one
// place so both spots always show the same colour for the same status.
export const DISCOVERY_BLOCK_STATUS_PILL_STYLE: Record<
  DiscoveryBlockStatus,
  string
> = {
  NOT_STARTED: "bg-status-todo/15 border-status-todo/30 text-status-todo",
  IN_PROGRESS:
    "bg-status-in-progress/15 border-status-in-progress/30 text-status-in-progress",
  COMPLETED:
    "bg-status-completed/15 border-status-completed/30 text-status-completed",
};

// human-readable labels for the status - discovery.tsx's own status-count
// pills spell these out as literal JSX text already, this is the same
// wording for anywhere else a status needs to render as text
export const DISCOVERY_BLOCK_STATUS_LABEL: Record<
  DiscoveryBlockStatus,
  string
> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

// mirrors CreateDiscoveryBlockDto's @MaxLength values on the backend
// (backend/src/discovery-blocks/dto/create-discovery-block.dto.ts) - kept in
// sync manually since frontend/backend are separate builds, no shared import
// possible.
export const DISCOVERY_BLOCK_TITLE_MAX_LENGTH = 100;
export const DISCOVERY_BLOCK_DESCRIPTION_MAX_LENGTH = 500;
export const DISCOVERY_BLOCK_NOTES_MAX_LENGTH = 2000;

// shape of a DiscoveryBlock exactly as the frontend uses it - mirrors the
// backend's Prisma model, not something we invent independently
export interface DiscoveryBlock {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  icon?: string;
  color?: number;
  status: DiscoveryBlockStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// GET all
export async function listDiscoveryBlocks(
  projectId: string
): Promise<DiscoveryBlock[]> {
  // apiClient<unknown>, not apiClient<DiscoveryBlock[]> - the generic there
  // is just a TS-level cast, it doesn't actually check the response shape.
  // parseDiscoveryBlock below is what does the real runtime check.
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/discovery-blocks"
  );
  if (!Array.isArray(payload)) {
    throw new Error("Discovery blocks response is invalid");
  }

  const parsed = payload.map(parseDiscoveryBlock);
  if (parsed.some((discoveryBlock) => discoveryBlock === null)) {
    throw new Error("DiscoveryBlock response contains invalid items");
  }

  return parsed as DiscoveryBlock[];
}

// GET (one)
export async function getDiscoveryBlock(
  projectId: string,
  discoveryBlockId: string
): Promise<DiscoveryBlock> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/discovery-blocks/" + discoveryBlockId
  );

  const parsed = parseDiscoveryBlock(payload);
  if (parsed === null) {
    throw new Error("Discovery block response is invalid");
  }

  return parsed;
}

// POST - creates a new category. Only `title` is required (mirrors
// CreateDiscoveryBlockDto); description/icon/color/notes are set afterward
// on the edit screen, not at creation time.
export async function createDiscoveryBlock(
  projectId: string,
  title: string
): Promise<DiscoveryBlock> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/discovery-blocks",
    {
      method: "POST",
      body: { title: title },
    }
  );

  const parsed = parseDiscoveryBlock(payload);
  if (parsed === null) {
    throw new Error("Discovery block creation response was invalid");
  }
  return parsed;
}

// DELETE - deletes the whole category, cascading its items on the backend
// (onDelete: Cascade in schema.prisma) - the backend returns the deleted
// block's own body (200, not 204), same as deleteDiscoveryBlockItem.
export async function deleteDiscoveryBlock(
  projectId: string,
  discoveryBlockId: string,
  fieldLockToken?: string
): Promise<DiscoveryBlock> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/discovery-blocks/" + discoveryBlockId,
    {
      method: "DELETE",
      headers:
        fieldLockToken === undefined
          ? undefined
          : { "X-Field-Lock-Token": fieldLockToken },
    }
  );

  const parsed = parseDiscoveryBlock(payload);
  if (parsed === null) {
    throw new Error("Discovery block deletion response was invalid");
  }
  return parsed;
}

// PATCH - takes one partial `updates` object (mirrors
// updateDiscoveryBlockItem's own convention) instead of positional params
// for every field - callers only send what they actually mean to change, so
// autosaving color/icon on click can't accidentally overwrite an unsaved
// Title/Description/Notes draft still sitting in the form.
export async function updateDiscoveryBlock(
  projectId: string,
  discoveryBlockId: string,
  updates: {
    title?: string;
    description?: string;
    notes?: string;
    color?: number;
    icon?: string;
  },
  fieldLockToken: string
): Promise<DiscoveryBlock> {
  // apiClient attaches X-CSRF-Token automatically for mutating requests
  // (PATCH here) and JSON-encodes `body` itself
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/discovery-blocks/" + discoveryBlockId,
    {
      method: "PATCH",
      body: updates,
      headers: { "X-Field-Lock-Token": fieldLockToken },
    }
  );

  const parsed = parseDiscoveryBlock(payload);
  if (parsed === null) {
    throw new Error("Discovery block modification was invalid");
  }
  return parsed;
}

// converts an untrusted JSON value into a real DiscoveryBlock, or null if it
// doesn't match the shape we expect. Never trust a `fetch` response body's
// type just because a TS type annotation says so - the backend, network, or
// a future API change could all send something unexpected at runtime.
export function parseDiscoveryBlock(value: unknown): DiscoveryBlock | null {
  if (!isRecord(value)) {
    return null;
  }

  // required fields: read each one explicitly, no destructuring
  const id = value.id;
  const projectId = value.projectId;
  const title = value.title;
  const status = value.status;
  const createdAt = value.createdAt;
  const updatedAt = value.updatedAt;

  // required fields: reject the whole item if any type is wrong
  if (typeof id !== "string") {
    return null;
  }
  if (typeof projectId !== "string") {
    return null;
  }
  if (typeof title !== "string") {
    return null;
  }
  if (
    status !== "NOT_STARTED" &&
    status !== "IN_PROGRESS" &&
    status !== "COMPLETED"
  ) {
    return null;
  }
  if (typeof createdAt !== "string") {
    return null;
  }
  if (typeof updatedAt !== "string") {
    return null;
  }

  // optional fields: keep the value if well-typed, fall back to undefined
  // instead of rejecting the whole item
  const description =
    typeof value.description === "string" ? value.description : undefined;
  const icon = typeof value.icon === "string" ? value.icon : undefined;
  const color = typeof value.color === "number" ? value.color : undefined;
  const notes = typeof value.notes === "string" ? value.notes : undefined;

  // explicit object form on purpose: { id: id } not { id }
  return {
    id: id,
    projectId: projectId,
    title: title,
    description: description,
    icon: icon,
    color: color,
    status: status,
    notes: notes,
    createdAt: createdAt,
    updatedAt: updatedAt,
  };
}

// narrows `unknown` down to "an object we can read string-keyed properties
// from" - the minimum needed before parseDiscoveryBlock can safely do
// value.id, value.title, etc. without TypeScript complaining. Doesn't check
// which properties exist or their types - parseDiscoveryBlock does that part.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
