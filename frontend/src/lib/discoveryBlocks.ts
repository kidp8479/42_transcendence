// This file avoids shorthand JS/TS forms (object shorthand, destructuring,
// spread) on purpose, while learning - explicit forms only, ex: `{ id: id }`
// instead of `{ id }`, `const id = value.id` instead of `const { id } = value`.
// Same equivalent meaning, just spelled out for now.
export type DiscoveryBlockStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

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
    throw new Error("Failed to load discovery blocks");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
