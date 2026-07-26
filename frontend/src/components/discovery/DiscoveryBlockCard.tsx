import { Link } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  DropdownItem,
  TextInput,
} from "flowbite-react";
import { useId, useState } from "react";
import {
  HiOutlineCog6Tooth,
  HiOutlineTrash,
  HiOutlineXMark,
} from "react-icons/hi2";
import type {
  DiscoveryBlock,
  DiscoveryBlockStatus,
} from "@/lib/discoveryBlocks";
import type { DiscoveryBlockItem } from "@/lib/discoveryBlockItems";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import { buildCategoryCheckboxTheme, darkDropdownTheme } from "@/lib/flowbite";
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

// same rounded-hover-item tweak as ProjectCard.tsx's own "..." menu
const roundedDropdownItemTheme = {
  container: "mx-1",
  base: "rounded-md",
};

// same black-background treatment as ProjectCard.tsx's own delete-confirm input
const confirmDeleteInputTheme = {
  field: {
    input: {
      colors: {
        gray: "!border-control-border !bg-black text-text-primary placeholder:!text-text-secondary focus:!border-control-error focus:!ring-2 focus:!ring-red-500/40 focus-visible:!outline-none",
      },
    },
  },
};

interface DiscoveryBlockCardProps {
  discoveryBlock: DiscoveryBlock;
  items: DiscoveryBlockItem[];
  onToggleItem: (item: DiscoveryBlockItem) => void;
  onDeleteBlock: () => Promise<boolean>;
}

// one card in the Discovery grid - color bar, icon/title/status, "..." menu
// (delete), progress bar, capped item preview.
//
// Same click-through pattern as ProjectCard.tsx: an absolutely-positioned
// <Link> covers the whole card, plain content sits in a pointer-events-none
// wrapper so clicks fall through to it, and the actually-interactive spots
// (checkboxes, "..." menu) opt back in with pointer-events-auto - avoids
// nesting a <button>/checkbox inside an <a>, which stopPropagation alone
// can't fully fix (invalid HTML, and dropdown click-outside logic gets
// unreliable nested in an anchor).
//
// "Delete category" doesn't call onDeleteBlock right away - it swaps the
// whole card for an inline "type the title to confirm" view first, same
// idea as ProjectCard.tsx's "Delete project".
export function DiscoveryBlockCard({
  discoveryBlock,
  items,
  onToggleItem,
  onDeleteBlock,
}: DiscoveryBlockCardProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const confirmInputId = useId();

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

  function handleCancelDelete() {
    setIsConfirmingDelete(false);
    setConfirmText("");
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      if (await onDeleteBlock()) {
        handleCancelDelete();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isConfirmingDelete) {
    const canConfirmDelete = confirmText.trim() === discoveryBlock.title;

    return (
      <div className="flex h-full flex-col gap-3 rounded-lg border border-control-error bg-surface-raised p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-primary">Delete category</h3>
          <button
            type="button"
            aria-label="Cancel delete category"
            onClick={handleCancelDelete}
            className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3">
          <p className="text-sm text-text-secondary">
            Type{" "}
            <span
              title={discoveryBlock.title}
              className="inline-block max-w-full truncate align-bottom font-semibold text-text-primary"
            >
              {discoveryBlock.title}
            </span>{" "}
            to confirm deletion. This also deletes its checklist. This cannot be
            undone.
          </p>

          <label htmlFor={confirmInputId} className="sr-only">
            Category title
          </label>
          <TextInput
            id={confirmInputId}
            autoFocus
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={discoveryBlock.title}
            theme={confirmDeleteInputTheme}
            value={confirmText}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            onClick={handleConfirmDelete}
            disabled={!canConfirmDelete || isDeleting}
            className="flex-1 bg-control-error !text-white hover:bg-red-700 focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-red-300 dark:bg-control-error dark:hover:bg-red-700 dark:focus:ring-red-800"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
          <Button
            type="button"
            onClick={handleCancelDelete}
            disabled={isDeleting}
            className="flex-1 border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:outline-none! focus-visible:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    // h-full: makes this grid item stretch to match the tallest card in its
    // row - relative: anchors the absolute Link overlay below
    <div className="relative h-full overflow-hidden rounded-lg border border-surface-border bg-surface-raised">
      <Link
        to="/$projectId/discovery/$discoveryBlockId/edit"
        params={{
          projectId: discoveryBlock.projectId,
          discoveryBlockId: discoveryBlock.id,
        }}
        aria-label={`Open ${discoveryBlock.title}`}
        className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      />

      {/* pointer-events-none lets clicks on plain content (title, description,
      progress, checklist labels...) fall through to the Link behind it -
      checkboxes and the "..." menu opt back in with pointer-events-auto,
      the only actually-interactive spots here */}
      <div className="pointer-events-none relative flex h-full flex-col">
        <div className={discoveryBlockColor.bg + " h-1.5"}></div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            {/* min-w-0 + truncate on the title, shrink-0 on the badge/menu:
            without both, a long title pushes them outside the card */}
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
              size convention in the app (summary/*.tsx) */}
              <h5
                className="truncate font-mono text-base font-semibold text-text-primary"
                title={discoveryBlock.title}
              >
                {discoveryBlock.title}
              </h5>
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center gap-1">
              <Badge
                color={
                  DISCOVERY_BLOCK_STATUS_BADGE_COLOR[discoveryBlock.status]
                }
              >
                {discoveryBlock.status}
              </Badge>
              <Dropdown
                arrowIcon={false}
                inline
                placement="bottom-end"
                theme={darkDropdownTheme}
                // see ProjectCard.tsx's own comment on this exact class -
                // Flowbite's default theme silently drops the border-style
                // darkDropdownTheme sets otherwise
                className="border-solid dark:border-solid"
                renderTrigger={() => (
                  <button
                    type="button"
                    aria-label={`Open actions for ${discoveryBlock.title}`}
                    className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  >
                    <HiOutlineCog6Tooth className="h-5 w-5" />
                  </button>
                )}
              >
                <DropdownItem
                  icon={HiOutlineTrash}
                  theme={roundedDropdownItemTheme}
                  className="text-control-error! dark:text-control-error!"
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  Delete category
                </DropdownItem>
              </Dropdown>
            </div>
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
                  {/* pointer-events-auto on the checkbox only, not the whole
                  row: clicking the label or surrounding whitespace should
                  still fall through to the card's Link and navigate, same
                  as before this card's overlay-Link rework */}
                  <Checkbox
                    className="pointer-events-auto h-4 w-4 shrink-0"
                    theme={checklistCheckboxTheme}
                    checked={item.isChecked}
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
        </div>
      </div>
    </div>
  );
}
