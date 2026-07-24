// Same explicit style as discoveryBlocks.ts on purpose - no destructuring,
// no object shorthand, while learning.

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
  // call the backend
  const response = await fetch(
    import.meta.env.VITE_API_URL +
      "/projects/" +
      projectId +
      "/discovery-blocks/" +
      discoveryBlockId +
      "/items",
    { credentials: "include" }
  );

  // fail fast if the HTTP status is not 2xx
  if (!response.ok) {
    throw new Error("Failed to load discovery block items");
  }

  // read the body as unknown (never trust it's already a DiscoveryBlockItem[])
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Discovery block items response is invalid");
  }

  const parsed = payload.map(parseDiscoveryBlockItem);
  if (parsed.some((discoveryBlockItem) => discoveryBlockItem === null)) {
    throw new Error("DiscoveryBlockItem response contains invalid items");
  }

  return parsed as DiscoveryBlockItem[];
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
