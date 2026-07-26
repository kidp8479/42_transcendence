// Same explicit style as discoveryBlocks.ts on purpose - no destructuring,
// no object shorthand, while learning.
import { apiClient } from "@/lib/apiClient";

// mirrors CreateDiscoveryBlockItemDto's @MaxLength on the backend
// (backend/src/discovery-block-items/dto/create-discovery-block-item.dto.ts)
// - see discoveryBlocks.ts's equivalent constants for why this is manually
// kept in sync rather than imported.
export const DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH = 200;

// All fields here are required (unlike DiscoveryBlock, which has optional
// description/icon/color/notes) - DiscoveryBlockItem has no optional field
// in the Prisma schema.
export interface DiscoveryBlockItem {
  id: string;
  discoveryBlockId: string;
  label: string;
  isChecked: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Note the two ids: the URL is nested one level deeper than DiscoveryBlock's
// (/projects/:projectId/discovery-blocks/:discoveryBlockId/items), so this
// function needs both to build the right path.
export async function listDiscoveryBlockItems(
  projectId: string,
  discoveryBlockId: string
): Promise<DiscoveryBlockItem[]> {
  const payload = await apiClient<unknown>(
    "/projects/" +
      projectId +
      "/discovery-blocks/" +
      discoveryBlockId +
      "/items"
  );
  if (!Array.isArray(payload)) {
    throw new Error("Discovery block items response is invalid");
  }

  const parsed = payload.map(parseDiscoveryBlockItem);
  if (parsed.some((discoveryBlockItem) => discoveryBlockItem === null)) {
    throw new Error("DiscoveryBlockItem response contains invalid items");
  }

  return parsed as DiscoveryBlockItem[];
}

// POST - creates a new item under the given block, always starts unchecked
// (isChecked defaults to false on the backend, not sent here).
export async function createDiscoveryBlockItem(
  projectId: string,
  discoveryBlockId: string,
  label: string,
  order: number
): Promise<DiscoveryBlockItem> {
  const payload = await apiClient<unknown>(
    "/projects/" +
      projectId +
      "/discovery-blocks/" +
      discoveryBlockId +
      "/items",
    {
      method: "POST",
      body: { label: label, order: order },
    }
  );

  const parsed = parseDiscoveryBlockItem(payload);
  if (parsed === null) {
    throw new Error("Discovery block item creation response was invalid");
  }
  return parsed;
}

// PATCH - all three fields optional (mirrors UpdateDiscoveryBlockItemDto on
// the backend, which extends the create DTO with PartialType + adds
// isChecked). Takes one options object instead of 3 positional params,
// since callers only ever set one field at a time: toggling the checkbox
// sends only isChecked, renaming sends only label, drag-to-reorder sends
// only order.
export async function updateDiscoveryBlockItem(
  projectId: string,
  discoveryBlockId: string,
  id: string,
  updates: { label?: string; order?: number; isChecked?: boolean }
): Promise<DiscoveryBlockItem> {
  const payload = await apiClient<unknown>(
    "/projects/" +
      projectId +
      "/discovery-blocks/" +
      discoveryBlockId +
      "/items/" +
      id,
    {
      method: "PATCH",
      body: updates,
    }
  );

  const parsed = parseDiscoveryBlockItem(payload);
  if (parsed === null) {
    throw new Error("Discovery block item modification response was invalid");
  }
  return parsed;
}

// DELETE - the backend returns the deleted item's own body (200, not 204),
// unlike deleteProject on the projects side, so this parses a response the
// same way every other function here does instead of returning void.
export async function deleteDiscoveryBlockItem(
  projectId: string,
  discoveryBlockId: string,
  id: string
): Promise<DiscoveryBlockItem> {
  const payload = await apiClient<unknown>(
    "/projects/" +
      projectId +
      "/discovery-blocks/" +
      discoveryBlockId +
      "/items/" +
      id,
    { method: "DELETE" }
  );

  const parsed = parseDiscoveryBlockItem(payload);
  if (parsed === null) {
    throw new Error("Discovery block item deletion response was invalid");
  }
  return parsed;
}

function parseDiscoveryBlockItem(value: unknown): DiscoveryBlockItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const discoveryBlockId = value.discoveryBlockId;
  const label = value.label;
  const isChecked = value.isChecked;
  const order = value.order;
  const createdAt = value.createdAt;
  const updatedAt = value.updatedAt;

  // required fields: reject the whole item if any type is wrong
  if (typeof id !== "string") {
    return null;
  }
  if (typeof discoveryBlockId !== "string") {
    return null;
  }
  if (typeof label !== "string") {
    return null;
  }
  if (typeof isChecked !== "boolean") {
    return null;
  }
  if (typeof order !== "number") {
    return null;
  }
  if (typeof createdAt !== "string") {
    return null;
  }
  if (typeof updatedAt !== "string") {
    return null;
  }

  return {
    id: id,
    discoveryBlockId: discoveryBlockId,
    label: label,
    isChecked: isChecked,
    order: order,
    createdAt: createdAt,
    updatedAt: updatedAt,
  };
}

// same helper as discoveryBlocks.ts - just checks value is a non-null object,
// so we can safely read arbitrary properties off it (value.id, value.label...)
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
