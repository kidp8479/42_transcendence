// This file avoids shorthand JS/TS forms (object shorthand, destructuring,
// spread) on purpose, while learning - explicit forms only, ex: `{ id: id }`
// instead of `{ id }`, `const id = value.id` instead of `const { id } = value`.
// Same equivalent meaning, just spelled out for now.
import { getSession } from "@/lib/auth";

export type DiscoveryBlockStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

// mirrors CreateDiscoveryBlockDto's @MaxLength values on the backend
// (backend/src/discovery-blocks/dto/create-discovery-block.dto.ts) - kept in
// sync manually since frontend/backend are separate builds, no shared import
// possible. Used as the edit screen's own maxLength attributes, so typing
// past the limit is blocked in the input itself instead of failing silently
// on save with no toast/notification system to explain why.
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
  // call the backend
  const response = await fetch(
    import.meta.env.VITE_API_URL +
      "/projects/" +
      projectId +
      "/discovery-blocks",
    { credentials: "include" }
  );

  // fail fast if the HTTP status is not 2xx
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Failed to load discovery blocks")
    );
  }

  // read the body as unknown (never trust it's already a DiscoveryBlock[])
  const payload: unknown = await response.json();
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
  const response = await fetch(
    import.meta.env.VITE_API_URL +
      "/projects/" +
      projectId +
      "/discovery-blocks/" +
      discoveryBlockId,
    { credentials: "include" }
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Failed to load discovery block")
    );
  }

  // same "don't trust it, parse it" pattern as listDiscoveryBlocks, just on
  // a single object instead of an array - no .map()/.some() needed here
  const payload: unknown = await response.json();

  const parsed = parseDiscoveryBlock(payload);
  if (parsed === null) {
    throw new Error("Discovery block response is invalid");
  }

  return parsed;
}

// PATCH - same URL as getDiscoveryBlock (one block, identified by both ids),
// but a different HTTP method + a request body carrying the new field values.
export async function updateDiscoveryBlock(
  projectId: string,
  discoveryBlockId: string,
  title: string,
  description: string,
  notes: string
): Promise<DiscoveryBlock> {
  // mutating requests (PATCH/POST/DELETE) are rejected with a 403 by the
  // auth service unless X-CSRF-Token is attached - see auth.guard.ts on the
  // backend and requiresCSRF() in the Go auth service
  const session = await getSession();
  if (!session) {
    throw new Error("An active session is required");
  }

  const response = await fetch(
    import.meta.env.VITE_API_URL +
      "/projects/" +
      projectId +
      "/discovery-blocks/" +
      discoveryBlockId,
    {
      method: "PATCH",
      credentials: "include",
      // tells the backend the body is JSON, not e.g. a plain string or form data
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      },
      // fetch's body must be a string - JSON.stringify turns our object into
      // the JSON text actually sent over the wire
      body: JSON.stringify({
        title: title,
        description: description,
        notes: notes,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Failed to modify discovery block")
    );
  }

  // backend returns the updated block - parse it the same way as
  // getDiscoveryBlock, so the caller gets back a real DiscoveryBlock, not
  // just "success"
  const payload: unknown = await response.json();

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
function parseDiscoveryBlock(value: unknown): DiscoveryBlock | null {
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

// reads the real backend error message out of a non-OK response instead of
// always throwing the same generic string - same gap we flagged on
// apiClient.ts (PR #18: "always the hardcoded API request failed (${status})
// string, never response.json()"), same fix already used in lib/auth.ts's
// own readErrorMessage. Falls back to the given generic message if the body
// isn't JSON or doesn't have a `message` field.
async function readErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return fallback;
  }

  const payload: unknown = await response.json();
  if (
    isRecord(payload) &&
    typeof payload.message === "string" &&
    payload.message.length > 0
  ) {
    return payload.message;
  }
  return fallback;
}
