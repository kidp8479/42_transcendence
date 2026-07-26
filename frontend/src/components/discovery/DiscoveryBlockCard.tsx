import { Link } from "@tanstack/react-router";
import { Badge, Card, Checkbox } from "flowbite-react";
import type {
  DiscoveryBlock,
  DiscoveryBlockStatus,
} from "@/lib/discoveryBlocks";
import type { DiscoveryBlockItem } from "@/lib/discoveryBlockItems";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import { buildCategoryCheckboxTheme } from "@/lib/flowbite";
import {
  DISCOVERY_BLOCK_ICON,
  DISCOVERY_BLOCK_DEFAULT_ICON,
} from "@/lib/discoveryBlockIcons";

// max items shown per card - keeps every card's height the same regardless
// of how many items the block actually has
const MAX_ITEMS_PREVIEW = 5;

const DISCOVERY_BLOCK_STATUS_BADGE_COLOR: Record<DiscoveryBlockStatus, string> =
  {
    NOT_STARTED: "gray",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
  };

interface DiscoveryBlockCardProps {
  discoveryBlock: DiscoveryBlock;
  items: DiscoveryBlockItem[];
  onToggleItem: (item: DiscoveryBlockItem) => void;
}

// one card in the Discovery grid - color bar, icon/title/status, progress
// bar, capped item preview. Clicking anywhere navigates to the edit screen;
// the checkbox stops that navigation itself (see its own onClick below).
export function DiscoveryBlockCard({
  discoveryBlock,
  items,
  onToggleItem,
}: DiscoveryBlockCardProps) {
  const discoveryBlockColor =
    CATEGORY_COLOR_PALETTE[discoveryBlock.color ?? 0] ??
    CATEGORY_COLOR_PALETTE[0];
  const DiscoveryBlockIcon =
    DISCOVERY_BLOCK_ICON[discoveryBlock.icon ?? ""] ??
    DISCOVERY_BLOCK_DEFAULT_ICON;
  const checklistCheckboxTheme =
    buildCategoryCheckboxTheme(discoveryBlockColor);

  const itemsDoneCount = items.filter((item) => item.isChecked).length;
  const itemsTotalCount = items.length;
  const itemsDonePercent =
    itemsTotalCount === 0
      ? 0
      : Math.round((itemsDoneCount / itemsTotalCount) * 100);

  // unchecked items first (team idea: a done item is less useful to see in
  // a small, capped preview than one still to do) - a copy since .sort()
  // mutates in place, and items is a prop we don't own
  const sortedItems = [...items].sort((a, b) => {
    if (a.isChecked === b.isChecked) {
      return 0;
    }
    return a.isChecked ? 1 : -1;
  });
  const previewItems = sortedItems.slice(0, MAX_ITEMS_PREVIEW);
  const hiddenItemsCount = itemsTotalCount - previewItems.length;

  return (
    <Link
      to="/$projectId/discovery/$discoveryBlockId/edit"
      params={{
        projectId: discoveryBlock.projectId,
        discoveryBlockId: discoveryBlock.id,
      }}
      // h-full: makes this grid item stretch to match the tallest card in
      // its row (Card below also needs h-full, a grid stretching its child
      // doesn't cascade further down on its own)
      className="h-full text-inherit no-underline"
    >
      <Card
        // dark: variants spelled out - Flowbite's own theme sets its own
        // dark:bg-gray-800 by default, an unprefixed override loses that fight
        className="h-full bg-surface-raised border-surface-border dark:border-surface-border dark:bg-surface-raised"
        // Card centers its content vertically by default once stretched -
        // overridden so extra height shows as space below, not a shifted header
        theme={{ root: { children: "justify-start" } }}
      >
        <div className={discoveryBlockColor.bg + " h-1.5"}></div>
        <div className="flex items-center justify-between gap-2">
          {/* min-w-0 + truncate on the title, shrink-0 on the Badge: without
          both, a long title pushes the Badge outside the card */}
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={
                discoveryBlockColor.bg +
                " flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
              }
            >
              <DiscoveryBlockIcon />
            </div>
            {/* text-base: matches every other card/section title's explicit
            size convention in the app (summary/*.tsx) - this h5 had no size
            class at all before, falling back to the browser default instead */}
            <h5
              className="truncate font-mono text-base font-semibold text-text-primary"
              title={discoveryBlock.title}
            >
              {discoveryBlock.title}
            </h5>
          </div>
          <Badge
            className="shrink-0"
            color={DISCOVERY_BLOCK_STATUS_BADGE_COLOR[discoveryBlock.status]}
          >
            {discoveryBlock.status}
          </Badge>
        </div>
        {discoveryBlock.description && (
          <p className="text-text-secondary text-sm">
            {discoveryBlock.description}
          </p>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">
            {itemsDoneCount}/{itemsTotalCount} done
          </span>
          <div className="h-1.5 w-full flex-1 rounded-full bg-surface-overlay">
            <div
              className={discoveryBlockColor.bg + " h-1.5 rounded-full"}
              style={{ width: itemsDonePercent + "%" }}
            ></div>
          </div>
        </div>
        <div className="border-t border-surface-border"></div>
        <div className="flex flex-col gap-2">
          {previewItems.map((item) => {
            return (
              <div key={item.id} className="flex items-center gap-2.5">
                {/* onClick's stopPropagation (not preventDefault) stops the
                click from bubbling into the wrapping <Link> without
                blocking the checkbox's own native toggle/repaint - readOnly
                is a no-op on checkbox inputs per the HTML spec, a real
                onChange is the correct controlled pattern here */}
                <Checkbox
                  className="h-4 w-4 shrink-0"
                  theme={checklistCheckboxTheme}
                  checked={item.isChecked}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => onToggleItem(item)}
                  aria-label={item.label}
                />
                <span
                  className="min-w-0 truncate text-sm text-text-secondary"
                  title={item.label}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
          {hiddenItemsCount > 0 && (
            <span className="text-xs text-text-secondary">
              +{hiddenItemsCount} more
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
