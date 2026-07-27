import { apiClient } from "./apiClient";

export type EvaluationChecklistSection = "MANDATORY" | "BONUS" | "SUPPLEMENTAL";

export interface EvaluationChecklistItem {
  id: string;
  label: string;
  isChecked: boolean;
  order: number;
  section: EvaluationChecklistSection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEvaluationChecklistSection(
  value: unknown
): value is EvaluationChecklistSection {
  return value === "MANDATORY" || value === "BONUS" || value === "SUPPLEMENTAL";
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

function parseEvaluationChecklistItems(
  value: unknown
): EvaluationChecklistItem[] {
  if (!Array.isArray(value)) {
    throw new Error("Items response is invalid");
  }
  const parsed = value.map(parseEvaluationChecklistItem);
  if (parsed.some((item) => item === null)) {
    throw new Error("Items response contains invalid items");
  }
  return parsed as EvaluationChecklistItem[];
}

// GET /projects/:projectId/evaluation-checklist-items
export function fetchEvaluationChecklistItems(
  projectId: string
): Promise<EvaluationChecklistItem[]> {
  return apiClient<unknown>(
    `/projects/${projectId}/evaluation-checklist-items`
  ).then(parseEvaluationChecklistItems);
}

// POST /projects/:projectId/evaluation-checklist-items
export function createEvaluationChecklistItem(
  projectId: string,
  dto: { label: string; section: EvaluationChecklistSection; order: number }
): Promise<EvaluationChecklistItem> {
  return apiClient<unknown>(
    `/projects/${projectId}/evaluation-checklist-items`,
    { method: "POST", body: dto }
  ).then((payload) => {
    const parsed = parseEvaluationChecklistItem(payload);
    if (parsed === null) {
      throw new Error("Item response is invalid");
    }
    return parsed;
  });
}

// PATCH /projects/:projectId/evaluation-checklist-items/:id
export function updateEvaluationChecklistItem(
  projectId: string,
  id: string,
  dto: Partial<{
    label: string;
    isChecked: boolean;
    order: number;
    section: EvaluationChecklistSection;
  }>
): Promise<EvaluationChecklistItem> {
  return apiClient<unknown>(
    `/projects/${projectId}/evaluation-checklist-items/${id}`,
    { method: "PATCH", body: dto }
  ).then((payload) => {
    const parsed = parseEvaluationChecklistItem(payload);
    if (parsed === null) {
      throw new Error("Item response is invalid");
    }
    return parsed;
  });
}

// DELETE /projects/:projectId/evaluation-checklist-items/:id => the backend
// returns the deleted item's own body (200, not 204 - no @HttpCode override
// on this route, unlike deleteProject), so this parses and returns it
// instead of assuming an empty response.
export function deleteEvaluationChecklistItem(
  projectId: string,
  id: string
): Promise<EvaluationChecklistItem> {
  return apiClient<unknown>(
    `/projects/${projectId}/evaluation-checklist-items/${id}`,
    { method: "DELETE" }
  ).then((payload) => {
    const parsed = parseEvaluationChecklistItem(payload);
    if (parsed === null) {
      throw new Error("Item response is invalid");
    }
    return parsed;
  });
}
