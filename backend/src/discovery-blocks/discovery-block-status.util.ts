import { DiscoveryBlockStatus } from "@prisma/client";

// Single source of truth for the NOT_STARTED/IN_PROGRESS/COMPLETED rule -
// used by DiscoveryBlocksService.recalculateStatus() (real usage, after every
// item mutation) and by seed.ts (initial value at insert time), so seeded
// data can never drift from what the real service would compute.
// Checklist progress only: 0 items or 0 checked => NOT_STARTED, some checked
// => IN_PROGRESS, all checked (and at least 1 item) => COMPLETED. Deliberately
// ignores `notes` - it has no defined notion of "complete".
export function computeDiscoveryBlockStatus(
  items: { isChecked: boolean }[]
): DiscoveryBlockStatus {
  const checkedCount = items.filter((item) => item.isChecked === true).length;

  if (items.length === 0 || checkedCount === 0) {
    return DiscoveryBlockStatus.NOT_STARTED;
  }
  if (checkedCount === items.length) {
    return DiscoveryBlockStatus.COMPLETED;
  }
  return DiscoveryBlockStatus.IN_PROGRESS;
}
