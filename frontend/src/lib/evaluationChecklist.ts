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

function parseEvaluationChecklistItems(value: unknown): EvaluationChecklistItem | null {
  if (!isRecord(value)) {
    
  }
}

export async function fetchEvaluationChecklistItems(projectId: string): Promise<EvaluationChecklistItem[]> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/projects`, { credentials: "include" });



  return parsed as EvaluationChecklistItem[];
}

export async function createEvaluationChecklistItem(projectId: string, dto: { label: string; section: EvaluationChecklistSection; order: number }): Promise<EvaluationChecklistItem> {

}

export async function updateEvaluationChecklistItem(projectId: string, id: string, dto: Partial< { label: string; isChecked: boolean; order: number; section: EvaluationChecklistSection }>): Promise<EvaluationChecklistItem> {

}

export async function deleteEvaluationChecklistItem(projectId: string, id: string): Promise<void> {
  
}
