import { Link } from "@tanstack/react-router";
import {
  Button,
  Checkbox,
  Dropdown,
  DropdownItem,
  TextInput,
} from "flowbite-react";
import { useEffect, useId, useState } from "react";
import {
  HiOutlineCog6Tooth,
  HiOutlineTrash,
  HiOutlineXMark,
} from "react-icons/hi2";
import {
  DISCOVERY_BLOCK_STATUS_LABEL,
  DISCOVERY_BLOCK_STATUS_PILL_STYLE,
  type DiscoveryBlock,
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
  onToggleItem: (item: DiscoveryBlockItem) => Promise<void>;
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

  // guards against a real race: onToggleItem updates isChecked optimistically
  // then PATCHes in the background - navigating into the edit screen while
  // that PATCH is still in flight can land its GET before the PATCH commits,
  // showing the pre-toggle state there. Counts rather than a boolean since
  // several items can be toggled in quick succession.
  const [pendingToggleCount, setPendingToggleCount] = useState(0);
  const hasPendingToggle = pendingToggleCount > 0;

  async function handleToggleItemClick(item: DiscoveryBlockItem) {
    setPendingToggleCount((count) => count + 1);
    try {
      await onToggleItem(item);
    } finally {
      setPendingToggleCount((count) => count - 1);
    }
  }

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

  // Escape closes the delete confirmation, same as clicking Cancel/X -
  // document-level because the confirmation isn't a real <dialog>/modal,
  // just conditionally-rendered content, so there's no native ESC handling
  useEffect(() => {
    if (!isConfirmingDelete) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCancelDelete();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isConfirmingDelete]);

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
            {/* not truncated here on purpose - the user needs to read the
            exact text to retype it, unlike everywhere else this title is
            just displayed */}
            <span className="font-semibold break-words text-text-primary">
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
      {/* pointer-events-none lets clicks on plain content (title, description,
      progress, checklist labels...) fall through to the navigation Link
      behind it - checkboxes and the "..." menu opt back in with
      pointer-events-auto, the only actually-interactive spots here */}
      <div className="pointer-events-none relative flex h-full flex-col">
        <div className={discoveryBlockColor.bg + " h-1.5"}></div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* The navigation Link only covers this header block (icon/title/
          badge/menu/description/progress), not the checklist below - an
          imprecise click near a checkbox used to fall through to a
          card-wide Link and misfire a navigation instead of toggling the
          item, since the checkbox's real hit area is only 16x16px. */}
          <div className="relative flex flex-col gap-3">
            {/* not rendered at all while a checkbox toggle is still saving -
            lets the edit screen's own fetch always run after the toggle's
            PATCH commits, instead of racing it and sometimes reading stale
            data. Link's own `disabled` prop does NOT work for this: it only
            skips the SPA navigate() call, the element is still a real
            <a href> underneath, so the browser follows it natively anyway.
            Swapping in a plain non-interactive div is the only way to
            actually block the click. cursor-wait signals why nothing
            happens, rather than looking broken. */}
            {hasPendingToggle ? (
              <div
                aria-label={`Open ${discoveryBlock.title}`}
                aria-disabled="true"
                className="absolute inset-0 pointer-events-auto cursor-wait"
              />
            ) : (
              <Link
                to="/$projectId/discovery/$discoveryBlockId/edit"
                params={{
                  projectId: discoveryBlock.projectId,
                  discoveryBlockId: discoveryBlock.id,
                }}
                aria-label={`Open ${discoveryBlock.title}`}
                className="absolute inset-0 pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              />
            )}
            {/* relative (like the card-wide wrapper this pattern is copied
            from): a later positioned sibling paints above the Link
            regardless of DOM order, so this whole block sits visually on
            top of it - pointer-events-none then lets plain content (title,
            description, progress) fall through to the Link beneath, while
            the badge/menu opts back in with pointer-events-auto and, being
            already on top, receives its clicks directly instead of the
            Link intercepting them */}
            <div className="pointer-events-none relative flex flex-col gap-3">
              {/* flex-wrap: the badge+menu group has its own natural minimum
            width (status text + the new "..." button); on a narrow 2-column
            card there isn't room left for both that AND the title on one
            line, so the group wraps to its own row below instead of
            squeezing the title down to 1-2 visible characters */}
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                size convention in the app (summary/*.tsx). pointer-events-auto:
                enables the title= tooltip on hover - trades away
                click-to-navigate on this exact text (the rest of the header
                still navigates) */}
                  <h5
                    className="pointer-events-auto truncate font-mono text-base font-semibold text-text-primary"
                    title={discoveryBlock.title}
                  >
                    {discoveryBlock.title}
                  </h5>
                </div>
                <div className="pointer-events-auto flex shrink-0 items-center gap-1">
                  <span
                    className={
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                      DISCOVERY_BLOCK_STATUS_PILL_STYLE[discoveryBlock.status]
                    }
                  >
                    {DISCOVERY_BLOCK_STATUS_LABEL[discoveryBlock.status]}
                  </span>
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
                // line-clamp-2: an unbounded description balloons this card's
                // height, and every other card sharing its grid row along with
                // it (h-full above stretches every card in a row to the tallest
                // one). pointer-events-auto: same title= tooltip tradeoff as
                // the title h5 above
                <p
                  className="pointer-events-auto line-clamp-2 text-text-secondary text-sm"
                  title={discoveryBlock.description}
                >
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
            </div>
          </div>
          <div className="border-t border-surface-border"></div>
          <div className="flex flex-col gap-2">
            {previewItems.map((item) => {
              return (
                <div key={item.id} className="flex items-center gap-2.5">
                  <Checkbox
                    className="pointer-events-auto h-4 w-4 shrink-0"
                    theme={checklistCheckboxTheme}
                    checked={item.isChecked}
                    onChange={() => void handleToggleItemClick(item)}
                    aria-label={item.label}
                  />
                  {/* pointer-events-auto: no navigation Link behind this
                  section anymore (see the header block above), so this
                  only enables the native title= tooltip on hover for
                  truncated labels - doesn't make the label do anything
                  on click, it has no handler */}
                  <span
                    className="pointer-events-auto min-w-0 truncate text-sm text-text-secondary"
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
