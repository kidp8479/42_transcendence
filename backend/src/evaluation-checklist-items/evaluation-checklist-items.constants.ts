export const EVALUATION_CHECKLIST_ITEM_LABEL_MAX_LENGTH = 350;

// Mirrors the frontend's EVALUATION_CHECKLIST_MAX_ITEMS_PER_CATEGORY
// (evaluation-checklist.tsx) - per project *and* section (MANDATORY/BONUS/
// SUPPLEMENTAL counted separately), enforced here since the frontend limit
// alone doesn't stop a direct API call.
export const EVALUATION_CHECKLIST_MAX_ITEMS_PER_SECTION = 50;
