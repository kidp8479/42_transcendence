import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createDiscoveryBlock,
  deleteDiscoveryBlock,
  listDiscoveryBlocks,
  type DiscoveryBlock,
  type DiscoveryBlockStatus,
} from "@/lib/discoveryBlocks";
import {
  listDiscoveryBlockItems,
  updateDiscoveryBlockItem,
  type DiscoveryBlockItem,
} from "@/lib/discoveryBlockItems";
import { DiscoveryBlockCard } from "@/components/discovery/DiscoveryBlockCard";
import { NewDiscoveryBlockCard } from "@/components/discovery/NewDiscoveryBlockCard";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { useToast } from "@/hooks/useToast";

interface DiscoveryBlockWithItems {
  discoveryBlock: DiscoveryBlock;
  items: DiscoveryBlockItem[];
}

// fetches every block, then every block's own items - the items requests
// are independent of each other, so they run in parallel (Promise.all)
// rather than one at a time
async function loadDiscoveryPageData(
  projectId: string
): Promise<DiscoveryBlockWithItems[]> {
  const discoveryBlocks = await listDiscoveryBlocks(projectId);

  const discoveryBlocksWithItems = await Promise.all(
    discoveryBlocks.map(async (discoveryBlock) => {
      const items = await listDiscoveryBlockItems(projectId, discoveryBlock.id);
      return { discoveryBlock: discoveryBlock, items: items };
    })
  );

  return discoveryBlocksWithItems;
}

export const Route = createFileRoute("/_authenticated/$projectId/discovery")({
  loader: (routeContext) =>
    loadDiscoveryPageData(routeContext.params.projectId),
  component: DiscoveryPage,
});

// pill style for the status-count counters - built from the app's own
// status-* tokens (index.css), not Flowbite's Badge colors, to get the
// thin-border/translucent-fill look Figma uses (see TaskStatusOverview.tsx)
const DISCOVERY_BLOCK_STATUS_PILL_STYLE: Record<DiscoveryBlockStatus, string> =
  {
    NOT_STARTED: "bg-status-todo/15 border-status-todo/30 text-status-todo",
    IN_PROGRESS:
      "bg-status-in-progress/15 border-status-in-progress/30 text-status-in-progress",
    COMPLETED:
      "bg-status-completed/15 border-status-completed/30 text-status-completed",
  };

function DiscoveryPage() {
  // useLoaderData() is itself generic - calling it directly inside
  // useState(...) breaks TS inference, so it's resolved to a local const first
  const loaderData = Route.useLoaderData();
  const params = Route.useParams();
  const [discoveryBlocksWithItems, setDiscoveryBlocksWithItems] =
    useState(loaderData);
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();

  // useState's initial value only seeds the first render - without this,
  // edits made on the edit screen (color, items, etc.) never show up here
  // if this component survives the navigation without unmounting
  useEffect(() => {
    setDiscoveryBlocksWithItems(loaderData);
  }, [loaderData]);

  // optimistic toggle: flips isChecked locally first, PATCHes in the
  // background, rolls back on failure
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
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to update item",
      });
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
      return;
    }
    await safeInvalidateRouter();
  }

  // not optimistic (mirrors handleAddItem on the edit screen) - the backend
  // assigns the real id, and this card list has no local "pending" concept
  async function handleCreateBlock(title: string): Promise<boolean> {
    try {
      const createdBlock = await createDiscoveryBlock(params.projectId, title);
      setDiscoveryBlocksWithItems((previous) => [
        ...previous,
        { discoveryBlock: createdBlock, items: [] },
      ]);
    } catch (error) {
      console.error("Failed to create discovery block", error);
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to create category",
      });
      return false;
    }
    await safeInvalidateRouter();
    showToast({ type: "success", message: "Category created" });
    return true;
  }

  async function handleDeleteBlock(discoveryBlockId: string): Promise<boolean> {
    try {
      await deleteDiscoveryBlock(params.projectId, discoveryBlockId);
      setDiscoveryBlocksWithItems((previous) =>
        previous.filter((entry) => entry.discoveryBlock.id !== discoveryBlockId)
      );
    } catch (error) {
      console.error("Failed to delete discovery block", error);
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete category",
      });
      return false;
    }
    await safeInvalidateRouter();
    showToast({ type: "success", message: "Category deleted" });
    return true;
  }

  const completedBlockCount = discoveryBlocksWithItems.filter(
    (entry) => entry.discoveryBlock.status === "COMPLETED"
  ).length;
  const inProgressBlockCount = discoveryBlocksWithItems.filter(
    (entry) => entry.discoveryBlock.status === "IN_PROGRESS"
  ).length;
  const notStartedBlockCount = discoveryBlocksWithItems.filter(
    (entry) => entry.discoveryBlock.status === "NOT_STARTED"
  ).length;

  // total items done / total items, across every block
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
      {/* intro text (left) + compact Overall Progress card (right) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-text-secondary">
          Break down the subject before you write a single line of code.
          Organize constraints, questions, and resources into checklists you can
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {discoveryBlocksWithItems.map((discoveryBlockWithItems) => (
          <DiscoveryBlockCard
            key={discoveryBlockWithItems.discoveryBlock.id}
            discoveryBlock={discoveryBlockWithItems.discoveryBlock}
            items={discoveryBlockWithItems.items}
            onToggleItem={(item) =>
              void handleToggleItem(
                discoveryBlockWithItems.discoveryBlock,
                item
              )
            }
            onDeleteBlock={() =>
              handleDeleteBlock(discoveryBlockWithItems.discoveryBlock.id)
            }
          />
        ))}
        <NewDiscoveryBlockCard onCreate={handleCreateBlock} />
      </div>
    </div>
  );
}
