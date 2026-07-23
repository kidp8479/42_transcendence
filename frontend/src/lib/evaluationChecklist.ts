export type EvaluationChecklistSection = "MANDATORY" | "BONUS" | "SUPPLEMENTAL";

export interface EvaluationChecklistItem {
  id: string;
  label: string;
  isChecked: boolean;
  order: number;
  section: EvaluationChecklistSection;
}

export class EvaluationChecklistUnauthorizedError extends Error {
  constructor() {
    super("Authentication is required to load checklist items");
    this.name = "EvaluationChecklistUnauthorizedError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEvaluationChecklistSection(
  value: unknown
): value is EvaluationChecklistSection {
  return value === "MANDATORY" || value === "BONUS" || value === "SUPPLEMENTAL";
}

function throwIfFailedResponse(value: Response, message: string) {
  if (value.status === 401) {
    throw new EvaluationChecklistUnauthorizedError();
  }

  if (!value.ok) {
    throw new Error(message);
  }
}

function parseEvaluationChecklistItem(
  value: unknown
): EvaluationChecklistItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, label, isChecked, order, section } = value;
  if (
    typeof id !== "string" ||
    typeof label !== "string" ||
    typeof isChecked !== "boolean" ||
    typeof order !== "number" ||
    !isEvaluationChecklistSection(section)
  ) {
    return null;
  }

  return { id, label, isChecked, order, section };
}

export async function fetchEvaluationChecklistItems(
  projectId: string
): Promise<EvaluationChecklistItem[]> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/evaluation-checklist-items`,
    { credentials: "include" }
  );

  throwIfFailedResponse(response, "Failed to load checklist items");

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Items response is invalid");
  }

  const parsed = payload.map(parseEvaluationChecklistItem);
  if (parsed.some((project) => project === null)) {
    throw new Error("Items response contains invalid items");
  }

  return parsed as EvaluationChecklistItem[];
}

export async function createEvaluationChecklistItem(
  projectId: string,
  dto: { label: string; section: EvaluationChecklistSection; order: number }
): Promise<EvaluationChecklistItem> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/evaluation-checklist-items`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    }
  );

  throwIfFailedResponse(response, "Failed to create checklist item");

  const payload: unknown = await response.json();
  const parsed = parseEvaluationChecklistItem(payload);
  if (parsed === null) {
    throw new Error("Item response is invalid");
  }

  return parsed;
}

export async function updateEvaluationChecklistItem(
  projectId: string,
  id: string,
  dto: Partial<{
    label: string;
    isChecked: boolean;
    order: number;
    section: EvaluationChecklistSection;
  }>
): Promise<EvaluationChecklistItem> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/evaluation-checklist-items/${id}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    }
  );

  throwIfFailedResponse(response, "Failed to update checklist item");

  const payload: unknown = await response.json();
  const parsed = parseEvaluationChecklistItem(payload);
  if (parsed === null) {
    throw new Error("Item response is invalid");
  }

  return parsed;
}

export async function deleteEvaluationChecklistItem(
  projectId: string,
  id: string
): Promise<void> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/evaluation-checklist-items/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  throwIfFailedResponse(response, "Failed to delete checklist item");
}
