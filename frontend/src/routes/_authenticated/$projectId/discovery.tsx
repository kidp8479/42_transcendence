import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Card, Checkbox } from "flowbite-react";
import {
  listDiscoveryBlocks,
  type DiscoveryBlock,
  type DiscoveryBlockStatus,
} from "@/lib/discoveryBlocks";
import {
  listDiscoveryBlockItems,
  updateDiscoveryBlockItem,
  type DiscoveryBlockItem,
} from "@/lib/discoveryBlockItems";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import { darkSurfaceCheckboxTheme } from "@/lib/flowbite";
import type { IconType } from "react-icons";
import {
  HiSearch,
  HiCollection,
  HiColorSwatch,
  HiLink,
  HiBookOpen,
  HiCog,
  HiOutlineFolder,
} from "react-icons/hi";

// bundles one DiscoveryBlock together with the items that belong to it -
// the shape the component actually needs to render a card's checklist.
interface DiscoveryBlockWithItems {
  discoveryBlock: DiscoveryBlock;
  items: DiscoveryBlockItem[];
}

// fetches every block, then - one block at a time (for...of, not .map(),
// since we need `await` inside the loop) - fetches that block's own items,
// and combines both into a single array the component can render directly.
async function loadDiscoveryPageData(
  projectId: string
): Promise<DiscoveryBlockWithItems[]> {
  const discoveryBlocks = await listDiscoveryBlocks(projectId);

  const discoveryBlocksWithItems: DiscoveryBlockWithItems[] = [];

  for (const discoveryBlock of discoveryBlocks) {
    const items = await listDiscoveryBlockItems(projectId, discoveryBlock.id);
    discoveryBlocksWithItems.push({
      discoveryBlock: discoveryBlock,
      items: items,
    });
  }

  return discoveryBlocksWithItems;
}

// loader runs before the page renders - fetches this route's own data
// (TanStack Router convention: each route loads what it needs, no parent
// over-fetch + filter). component is what actually gets displayed once the
// loader's promise resolves.
export const Route = createFileRoute("/_authenticated/$projectId/discovery")({
  loader: (routeContext) =>
    loadDiscoveryPageData(routeContext.params.projectId),
  component: DiscoveryPage,
});

// Badge color per status - Flowbite's fixed set of named colors, chosen to
// match the semantic meaning of each DiscoveryBlockStatus value.
const DISCOVERY_BLOCK_STATUS_BADGE_COLOR: Record<DiscoveryBlockStatus, string> =
  {
    NOT_STARTED: "gray",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
  };

// Pill style per status, for the status-count pills only - built from the
// app's own status-* design tokens (index.css) rather than Flowbite's fixed
// Badge colors, since those tokens are what the rest of the app already uses
// for status (see TaskStatusOverview.tsx) and are a closer match to Figma's
// thin-border/translucent-fill look than a solid-filled Badge. Every class
// written out in full - see categoryColorPalette.ts's note on why a class
// built at runtime by joining strings never gets picked up by Tailwind.
const DISCOVERY_BLOCK_STATUS_PILL_STYLE: Record<DiscoveryBlockStatus, string> =
  {
    NOT_STARTED: "bg-status-todo/15 border-status-todo/30 text-status-todo",
    IN_PROGRESS:
      "bg-status-in-progress/15 border-status-in-progress/30 text-status-in-progress",
    COMPLETED:
      "bg-status-completed/15 border-status-completed/30 text-status-completed",
  };

// Icon per icon name - matches the free-text names stored in seed.ts
// ("search", "layers", ...). Not an exhaustive Record like the status table
// above: DiscoveryBlock.icon is a free string on the backend (no fixed set
// yet, see the DTO's own comment), so an unknown name must fall back to a
// default icon instead of being a compile-time error.
const DISCOVERY_BLOCK_ICON: Record<string, IconType> = {
  search: HiSearch,
  layers: HiCollection,
  palette: HiColorSwatch,
  link: HiLink,
  notebook: HiBookOpen,
  wheel: HiCog,
};

// max items shown per card - keeps every card's height the same regardless
// of how many items the block actually has
const MAX_ITEMS_PREVIEW = 5;

function DiscoveryPage() {
  // seeded from whatever the loader returned, but now kept in useState -
  // the loader's own result never changes after the initial render, so
  // toggling a checkbox needs its own local, mutable copy to update.
  // useLoaderData is itself generic (it accepts options like `select`) -
  // calling it directly inside useState(...) makes TS fail to infer its
  // return type (it falls back to `never`), so it's resolved to a plain
  // local const first, then passed to useState separately.
  const loaderData = Route.useLoaderData();
  const [discoveryBlocksWithItems, setDiscoveryBlocksWithItems] =
    useState(loaderData);

  // optimistic update: flips isChecked in local state immediately (so the
  // checkbox reacts instantly, no waiting on the network), fires the PATCH
  // in the background, and rolls the state back if the request fails -
  // rather than waiting for the server's response before showing anything.
  async function handleToggleItem(
    discoveryBlock: DiscoveryBlock,
    item: DiscoveryBlockItem
  ): Promise<void> {
    const discoveryBlockId = discoveryBlock.id;
    const newIsChecked = !item.isChecked;

    setDiscoveryBlocksWithItems((previous) =>
      previous.map((entry) => {
        if (entry.discoveryBlock.id !== discoveryBlockId) {
          return entry;
        }
        return {
          discoveryBlock: entry.discoveryBlock,
          items: entry.items.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, isChecked: newIsChecked }
              : currentItem
          ),
        };
      })
    );

    try {
      await updateDiscoveryBlockItem(
        discoveryBlock.projectId,
        discoveryBlockId,
        item.id,
        { isChecked: newIsChecked }
      );
    } catch (error) {
      console.error("Failed to update discovery block item", error);
      // rollback: put isChecked back to what it was before the optimistic
      // update, since the PATCH never actually succeeded
      setDiscoveryBlocksWithItems((previous) =>
        previous.map((entry) => {
          if (entry.discoveryBlock.id !== discoveryBlockId) {
            return entry;
          }
          return {
            discoveryBlock: entry.discoveryBlock,
            items: entry.items.map((currentItem) =>
              currentItem.id === item.id
                ? { ...currentItem, isChecked: item.isChecked }
                : currentItem
            ),
          };
        })
      );
    }
  }

  // status pill counts: how many blocks currently have each status. .filter()
  // keeps only the entries matching, .length counts them - same pattern
  // already used for itemsDoneCount below, just filtering blocks instead of
  // items.
  const completedBlockCount = discoveryBlocksWithItems.filter(
    (entry) => entry.discoveryBlock.status === "COMPLETED"
  ).length;
  const inProgressBlockCount = discoveryBlocksWithItems.filter(
    (entry) => entry.discoveryBlock.status === "IN_PROGRESS"
  ).length;
  const notStartedBlockCount = discoveryBlocksWithItems.filter(
    (entry) => entry.discoveryBlock.status === "NOT_STARTED"
  ).length;

  // overall progress: total items done / total items, across every block.
  // A loop nested inside another loop - the outer one visits each block
  // entry, the inner one visits that block's own items - accumulating into
  // two counters declared before both loops start.
  let overallItemsDoneCount = 0;
  let overallItemsTotalCount = 0;
  for (const entry of discoveryBlocksWithItems) {
    for (const item of entry.items) {
      overallItemsTotalCount = overallItemsTotalCount + 1;
      if (item.isChecked === true) {
        overallItemsDoneCount = overallItemsDoneCount + 1;
      }
    }
  }
  const overallItemsDonePercent =
    overallItemsTotalCount === 0
      ? 0
      : Math.round((overallItemsDoneCount / overallItemsTotalCount) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* intro text (left) + compact Overall Progress card (right), side by
          side - matches Figma's layout instead of a full-width banner */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-text-secondary">
          Break down the subject before you write a single line of code -
          organize constraints, questions, and resources into checklists you can
          track.
        </p>
        <div className="w-full max-w-xs rounded-lg border border-surface-border bg-surface-raised p-4 dark:border-surface-border dark:bg-surface-raised">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-text-primary">
              Overall Progress
            </span>
            <span className="text-sm font-semibold text-brand-500">
              {overallItemsDonePercent}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-overlay">
            <div
              className="h-1.5 rounded-full bg-brand-500"
              style={{ width: overallItemsDonePercent + "%" }}
            ></div>
          </div>
          <p className="mt-2 text-xs text-brand-500">
            {overallItemsDoneCount} / {overallItemsTotalCount} completed
          </p>
        </div>
      </div>

      {/* status pills - read-only counters, not clickable filters (decided
          explicitly: no useState needed for this brick). Plain <span>, not
          Flowbite's <Badge> - the status-* tokens give a thin-border,
          translucent-fill pill Badge's fixed color set can't produce. */}
      <div className="flex flex-wrap gap-2">
        <span
          className={
            "rounded-full border px-3 py-1 text-sm font-medium " +
            DISCOVERY_BLOCK_STATUS_PILL_STYLE.NOT_STARTED
          }
        >
          {notStartedBlockCount} Not Started
        </span>
        <span
          className={
            "rounded-full border px-3 py-1 text-sm font-medium " +
            DISCOVERY_BLOCK_STATUS_PILL_STYLE.IN_PROGRESS
          }
        >
          {inProgressBlockCount} In Progress
        </span>
        <span
          className={
            "rounded-full border px-3 py-1 text-sm font-medium " +
            DISCOVERY_BLOCK_STATUS_PILL_STYLE.COMPLETED
          }
        >
          {completedBlockCount} Completed
        </span>
      </div>

      {/* capped at 2 columns (not 3) to match Figma - more width per card,
        long titles like "PDF Project Understanding" fit on one line */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* .map: transforms DiscoveryBlockWithItems[] into one <Card> per
            entry. Runs once per element - everything inside this callback is
            computed fresh for each entry. */}
        {discoveryBlocksWithItems.map((discoveryBlockWithItems) => {
          const discoveryBlock = discoveryBlockWithItems.discoveryBlock;
          const items = discoveryBlockWithItems.items;

          // index into the palette by this block's own color (0-7), falling
          // back to index 0 twice: once if color is missing (?? 0), once if
          // the resulting index is somehow out of the palette's range
          const discoveryBlockColor =
            CATEGORY_COLOR_PALETTE[discoveryBlock.color ?? 0] ??
            CATEGORY_COLOR_PALETTE[0];
          // look up this block's icon name in the lookup table; unknown/missing
          // names fall back to a generic folder icon instead of crashing
          const DiscoveryBlockIcon =
            DISCOVERY_BLOCK_ICON[discoveryBlock.icon ?? ""] ?? HiOutlineFolder;

          // "X/Y done" + progress percent, computed fresh from the items array
          // on every render (no separate state to keep in sync - the items
          // array is always the single source of truth)
          const itemsDoneCount = items.filter(
            (item) => item.isChecked === true
          ).length;
          const itemsTotalCount = items.length;
          const itemsDonePercent =
            itemsTotalCount === 0
              ? 0
              : Math.round((itemsDoneCount / itemsTotalCount) * 100);

          // preview: at most MAX_ITEMS_PREVIEW rows, so card height stays
          // fixed regardless of how many items the block actually has
          const previewItems = items.slice(0, MAX_ITEMS_PREVIEW);
          const hiddenItemsCount = itemsTotalCount - previewItems.length;

          return (
            // key moved to Link (the outermost element .map() produces now) -
            // clicking anywhere on the card navigates to its edit screen.
            // no-underline/text-inherit: Link renders as <a>, which the
            // browser styles blue+underlined by default - overridden here
            // since this isn't meant to read as a text link.
            <Link
              key={discoveryBlock.id}
              to="/$projectId/discovery/$discoveryBlockId/edit"
              params={{
                projectId: discoveryBlock.projectId,
                discoveryBlockId: discoveryBlock.id,
              }}
              className="text-inherit no-underline"
            >
              <Card
                // dark: variants written explicitly, not just the plain classes:
                // Flowbite's own Card theme sets "dark:bg-gray-800 dark:border-
                // gray-700" by default, and an unprefixed override loses that
                // fight in dark mode (same issue already hit on Checkbox
                // elsewhere in the app) - our own dark: rule has to be spelled
                // out to actually win.
                className="bg-surface-raised border-surface-border dark:border-surface-border dark:bg-surface-raised"
              >
                {/* color bar: an empty div, just a colored rectangle (height set,
                no content) */}
                <div className={discoveryBlockColor.bg + " h-1.5"}></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* icon circle: same background color as the bar above, icon
                    component rendered as a JSX tag (capitalized variable name
                    required for that) */}
                    <div
                      className={
                        discoveryBlockColor.bg +
                        " flex h-8 w-8 items-center justify-center rounded-full text-white"
                      }
                    >
                      <DiscoveryBlockIcon />
                    </div>
                    <h5 className="font-mono font-semibold text-text-primary">
                      {discoveryBlock.title}
                    </h5>
                  </div>
                  <Badge
                    color={
                      DISCOVERY_BLOCK_STATUS_BADGE_COLOR[discoveryBlock.status]
                    }
                  >
                    {discoveryBlock.status}
                  </Badge>
                </div>
                {/* conditional render: `x && (...)` shows the JSX only if x is
                truthy - here, only when description actually has a value */}
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
                <div className="flex flex-col gap-2">
                  {/* previewItems, not items: caps rows at MAX_ITEMS_PREVIEW so
                  every card has the same height regardless of item count */}
                  {previewItems.map((item) => {
                    return (
                      <div key={item.id} className="flex items-center gap-2.5">
                        {/* readOnly is a no-op on checkbox/radio inputs per
                        the HTML spec (only text-like inputs respect it) -
                        using it here caused a real visual bug: the browser's
                        own native checked-toggle-on-click still fired
                        unpredictably alongside our own state update, so the
                        box sometimes didn't visually flip until a later
                        render. Fixed by using a real onChange (the correct
                        controlled-checkbox pattern) and letting the browser's
                        native toggle happen normally - onClick's
                        stopPropagation (not preventDefault) is enough to stop
                        the click from bubbling into the wrapping <Link> and
                        navigating, without blocking the checkbox's own
                        default toggle/repaint. */}
                        <Checkbox
                          // h-4/w-4 already come from Flowbite's own theme,
                          // but repeated explicitly + shrink-0 here as a
                          // defensive fix for a real distortion bug seen on
                          // narrow (mobile-emulated) viewports - the box
                          // rendered stretched into a tall oval instead of a
                          // 16x16 square, shrink-0 stops a flex child from
                          // being compressed/stretched to fill the row
                          className="h-4 w-4 shrink-0"
                          theme={darkSurfaceCheckboxTheme}
                          checked={item.isChecked}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() =>
                            void handleToggleItem(discoveryBlock, item)
                          }
                        />
                        {/* truncate: forces one line (ellipsis instead of
                        wrapping) so every item row is the same height,
                        regardless of label length - min-w-0 needed because
                        flex items don't shrink below their content size
                        otherwise, which would silently disable truncate */}
                        {/* title: native browser tooltip on hover, shows the
                        full label when it's been cut off by truncate */}
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
        })}
      </div>
    </div>
  );
}
