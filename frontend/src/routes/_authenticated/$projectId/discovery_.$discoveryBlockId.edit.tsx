import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  getDiscoveryBlock,
  updateDiscoveryBlock,
  DISCOVERY_BLOCK_TITLE_MAX_LENGTH,
  DISCOVERY_BLOCK_DESCRIPTION_MAX_LENGTH,
  DISCOVERY_BLOCK_NOTES_MAX_LENGTH,
} from "@/lib/discoveryBlocks";
import {
  listDiscoveryBlockItems,
  createDiscoveryBlockItem,
  updateDiscoveryBlockItem,
  deleteDiscoveryBlockItem,
  type DiscoveryBlockItem,
} from "@/lib/discoveryBlockItems";
import { useEffect, useState } from "react";
import { Label, TextInput, Textarea, Button } from "flowbite-react";
import { HiArrowLeft } from "react-icons/hi";
import {
  darkSurfaceFieldClassName,
  darkSurfaceTextInputTheme,
  buildCategoryCheckboxTheme,
} from "@/lib/flowbite";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import {
  DISCOVERY_BLOCK_ICON,
  DISCOVERY_BLOCK_ICON_NAMES,
  DISCOVERY_BLOCK_DEFAULT_ICON,
} from "@/lib/discoveryBlockIcons";
import { DiscoveryBlockAppearancePicker } from "@/components/discovery/DiscoveryBlockAppearancePicker";
import { DiscoveryBlockChecklist } from "@/components/discovery/DiscoveryBlockChecklist";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { useToast } from "@/hooks/useToast";

// trailing "_" opts out of nesting under discovery.tsx (no <Outlet/> there)
export const Route = createFileRoute(
  "/_authenticated/$projectId/discovery_/$discoveryBlockId/edit"
)({
  loader: async (routeContext) => {
    const discoveryBlock = await getDiscoveryBlock(
      routeContext.params.projectId,
      routeContext.params.discoveryBlockId
    );
    const items = await listDiscoveryBlockItems(
      routeContext.params.projectId,
      routeContext.params.discoveryBlockId
    );
    return { discoveryBlock: discoveryBlock, items: items };
  },
  component: DiscoveryBlockEditPage,
});

function DiscoveryBlockEditPage() {
  // resolved to a local const first, then passed to useState - calling
  // Route.useLoaderData() directly inside useState(...) breaks TS inference
  const loaderData = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();

  // same race as discovery.tsx's card: handleToggleItem below flips
  // isChecked optimistically then PATCHes in the background - leaving this
  // screen (Back or Escape) while that PATCH is still in flight can let the
  // list's own GET land before the PATCH commits, showing the pre-toggle
  // state there
  const [pendingToggleCount, setPendingToggleCount] = useState(0);
  const hasPendingToggle = pendingToggleCount > 0;

  // Escape goes back to the Discovery list, same target as the Back link
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !hasPendingToggle) {
        void navigate({
          to: "/$projectId/discovery",
          params: { projectId: params.projectId },
        });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, params.projectId, hasPendingToggle]);

  const [title, setTitle] = useState(loaderData.discoveryBlock.title);
  const [description, setDescription] = useState(
    loaderData.discoveryBlock.description ?? ""
  );
  const [notes, setNotes] = useState(loaderData.discoveryBlock.notes ?? "");
  const [items, setItems] = useState<DiscoveryBlockItem[]>(loaderData.items);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [selectedColorIndex, setSelectedColorIndex] = useState(
    loaderData.discoveryBlock.color ?? 0
  );
  const [selectedIcon, setSelectedIcon] = useState(
    loaderData.discoveryBlock.icon ?? DISCOVERY_BLOCK_ICON_NAMES[0]
  );

  // reads from state, not loaderData - picking a swatch/icon below updates
  // this (and everything derived from it) live, before Save is even clicked
  const discoveryBlockColor =
    CATEGORY_COLOR_PALETTE[selectedColorIndex] ?? CATEGORY_COLOR_PALETTE[0];
  const SelectedDiscoveryBlockIcon =
    DISCOVERY_BLOCK_ICON[selectedIcon] ?? DISCOVERY_BLOCK_DEFAULT_ICON;
  const checklistCheckboxTheme =
    buildCategoryCheckboxTheme(discoveryBlockColor);

  const itemsDoneCount = items.filter((item) => item.isChecked).length;
  const itemsTotalCount = items.length;
  const itemsDonePercent =
    itemsTotalCount === 0
      ? 0
      : Math.round((itemsDoneCount / itemsTotalCount) * 100);

  // same "unchecked items first" sort as the card preview (DiscoveryBlockCard.tsx)
  // - the two screens showed items in different orders (this one by creation
  // order, the card by check state), so toggling an item then comparing "the
  // same visual position" between the two could look at two different items.
  // A copy since .sort() mutates in place, and handleAddItem below relies on
  // items.length (creation order) for the new item's position - not sortedItems
  const sortedItems = [...items].sort((a, b) => {
    if (a.isChecked === b.isChecked) {
      return 0;
    }
    return a.isChecked ? 1 : -1;
  });

  async function handleSave(): Promise<void> {
    try {
      // color/icon are autosaved separately (handleColorChange/
      // handleIconChange below) - not sent again here
      await updateDiscoveryBlock(params.projectId, params.discoveryBlockId, {
        title: title,
        description: description,
        notes: notes,
      });
    } catch (error) {
      console.error("Failed to save discovery block", error);
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to save category",
      });
      return;
    }
    await safeInvalidateRouter();
    showToast({ type: "success", message: "Changes saved" });
  }

  // color/icon autosave on click, same optimistic pattern as the checkbox
  // toggle below - a discrete click, unlike Title/Description/Notes which
  // need a real "saving..." indicator before autosave-while-typing is safe
  async function handleColorChange(newColorIndex: number): Promise<void> {
    const previousColorIndex = selectedColorIndex;
    setSelectedColorIndex(newColorIndex);
    try {
      await updateDiscoveryBlock(params.projectId, params.discoveryBlockId, {
        color: newColorIndex,
      });
    } catch (error) {
      console.error("Failed to save discovery block color", error);
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to save color",
      });
      setSelectedColorIndex(previousColorIndex);
      return;
    }
    await safeInvalidateRouter();
  }

  async function handleIconChange(newIcon: string): Promise<void> {
    const previousIcon = selectedIcon;
    setSelectedIcon(newIcon);
    try {
      await updateDiscoveryBlock(params.projectId, params.discoveryBlockId, {
        icon: newIcon,
      });
    } catch (error) {
      console.error("Failed to save discovery block icon", error);
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save icon",
      });
      setSelectedIcon(previousIcon);
      return;
    }
    await safeInvalidateRouter();
  }

  // creates on the backend first, then appends the real returned item (with
  // its real id) - not optimistic, we need the backend-assigned id before
  // this item can be deleted or toggled
  async function handleAddItem(): Promise<void> {
    const label = newItemLabel.trim();
    if (label === "") {
      return;
    }

    try {
      const createdItem = await createDiscoveryBlockItem(
        params.projectId,
        params.discoveryBlockId,
        label,
        items.length
      );
      setItems((previousItems) => [...previousItems, createdItem]);
      setNewItemLabel("");
    } catch (error) {
      console.error("Failed to create discovery block item", error);
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to add item",
      });
      return;
    }
    await safeInvalidateRouter();
  }

  async function handleRemoveItem(id: string): Promise<void> {
    try {
      await deleteDiscoveryBlockItem(
        params.projectId,
        params.discoveryBlockId,
        id
      );
      setItems((previousItems) =>
        previousItems.filter((item) => item.id !== id)
      );
    } catch (error) {
      console.error("Failed to delete discovery block item", error);
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete item",
      });
      return;
    }
    await safeInvalidateRouter();
  }

  // optimistic toggle, same pattern as discovery.tsx's card checkbox -
  // duplicated rather than shared, the two files read different data shapes
  // (a single block's items here vs every block's items there)
  async function handleToggleItem(item: DiscoveryBlockItem): Promise<void> {
    const newIsChecked = !item.isChecked;

    setItems((previousItems) =>
      previousItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, isChecked: newIsChecked }
          : currentItem
      )
    );

    try {
      await updateDiscoveryBlockItem(
        params.projectId,
        params.discoveryBlockId,
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
      setItems((previousItems) =>
        previousItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, isChecked: item.isChecked }
            : currentItem
        )
      );
      return;
    }
    await safeInvalidateRouter();
  }

  async function handleToggleItemClick(item: DiscoveryBlockItem) {
    setPendingToggleCount((count) => count + 1);
    try {
      await handleToggleItem(item);
    } finally {
      setPendingToggleCount((count) => count - 1);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* flex-wrap: on narrow screens "Back | Edit Category" + the button
      no longer fit on one line, lets the button wrap instead of overflowing */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* not a real <Link> while a toggle is still saving - Link's own
          `disabled` prop doesn't block anything, it's still a real <a href>
          underneath that the browser follows natively regardless (see
          DiscoveryBlockCard.tsx's own fix for the same issue) */}
          {hasPendingToggle ? (
            <span
              aria-disabled="true"
              className="flex cursor-wait items-center gap-1 text-sm text-text-secondary"
            >
              <HiArrowLeft />
              Back
            </span>
          ) : (
            <Link
              to="/$projectId/discovery"
              params={{ projectId: params.projectId }}
              className="flex items-center gap-1 text-sm text-text-secondary no-underline hover:text-text-primary"
            >
              <HiArrowLeft />
              Back
            </Link>
          )}
          <span className="text-surface-border">|</span>
          <div className="flex items-center gap-2">
            {/* renders the currently *selected* icon (state), not just the
            saved one - live preview while picking below */}
            <div className={discoveryBlockColor.badgeBg + " rounded p-1"}>
              <SelectedDiscoveryBlockIcon
                className={discoveryBlockColor.text}
              />
            </div>
            <h1 className="font-mono font-semibold text-text-primary">
              Edit Category
            </h1>
          </div>
        </div>
        {/* black text: white on brand-500 fails WCAG AA contrast (~2.3:1) */}
        <Button
          className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </div>

      {/* single column below lg, 2 columns above (fields left, checklist right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <DiscoveryBlockAppearancePicker
            selectedColorIndex={selectedColorIndex}
            selectedIcon={selectedIcon}
            discoveryBlockColor={discoveryBlockColor}
            onColorChange={(colorIndex) => void handleColorChange(colorIndex)}
            onIconChange={(iconName) => void handleIconChange(iconName)}
          />
          <div>
            <Label
              htmlFor="discovery-block-title"
              className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
            >
              Title
            </Label>
            <TextInput
              id="discovery-block-title"
              theme={darkSurfaceTextInputTheme}
              placeholder="e.g. Constraints"
              maxLength={DISCOVERY_BLOCK_TITLE_MAX_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div>
            <Label
              htmlFor="discovery-block-description"
              className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
            >
              Description
            </Label>
            <Textarea
              id="discovery-block-description"
              className={darkSurfaceFieldClassName}
              placeholder="What is this category about?"
              maxLength={DISCOVERY_BLOCK_DESCRIPTION_MAX_LENGTH}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div>
            <Label
              htmlFor="discovery-block-notes"
              className="text-xs font-semibold tracking-wide text-text-secondary uppercase"
            >
              Notes
            </Label>
            <Textarea
              id="discovery-block-notes"
              className={darkSurfaceFieldClassName}
              placeholder="Add your detailed notes here..."
              maxLength={DISCOVERY_BLOCK_NOTES_MAX_LENGTH}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="mb-4 rounded-lg border border-surface-border bg-surface-raised p-4 dark:border-surface-border dark:bg-surface-raised">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                {itemsDoneCount} / {itemsTotalCount} completed
              </span>
              <span
                className={"text-sm font-semibold " + discoveryBlockColor.text}
              >
                {itemsDonePercent}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-surface-overlay">
              <div
                className={discoveryBlockColor.bg + " h-1.5 rounded-full"}
                style={{ width: itemsDonePercent + "%" }}
              ></div>
            </div>
          </div>

          <DiscoveryBlockChecklist
            items={sortedItems}
            discoveryBlockColor={discoveryBlockColor}
            checklistCheckboxTheme={checklistCheckboxTheme}
            newItemLabel={newItemLabel}
            onNewItemLabelChange={setNewItemLabel}
            onToggleItem={(item) => void handleToggleItemClick(item)}
            onRemoveItem={(id) => void handleRemoveItem(id)}
            onAddItem={() => void handleAddItem()}
          />
        </div>
      </div>
    </div>
  );
}
