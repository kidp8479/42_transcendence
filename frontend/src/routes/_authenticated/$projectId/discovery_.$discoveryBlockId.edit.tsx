import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
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
  DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH,
  type DiscoveryBlockItem,
} from "@/lib/discoveryBlockItems";
import { useState } from "react";
import { Label, TextInput, Textarea, Button, Checkbox } from "flowbite-react";
import { HiArrowLeft, HiX, HiPlus, HiCheck } from "react-icons/hi";
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

// trailing "_" opts out of nesting under discovery.tsx (no <Outlet/> there)
export const Route = createFileRoute(
  "/_authenticated/$projectId/discovery_/$discoveryBlockId/edit"
)({
  // loads both the block itself AND its items - same 2-step pattern as
  // discovery.tsx's loadDiscoveryPageData, just for one block instead of all
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
  // resolved to a local const first, then destructured/passed to useState -
  // calling Route.useLoaderData() directly inside useState(...) breaks
  // TypeScript's inference here (see discovery.tsx's own note on this)
  const loaderData = Route.useLoaderData();
  const params = Route.useParams();
  const router = useRouter();

  // editable local state, seeded from the loader's data
  const [title, setTitle] = useState(loaderData.discoveryBlock.title);
  const [description, setDescription] = useState(
    loaderData.discoveryBlock.description ?? ""
  );
  const [notes, setNotes] = useState(loaderData.discoveryBlock.notes ?? "");
  const [items, setItems] = useState<DiscoveryBlockItem[]>(loaderData.items);
  // controlled input for the "add new item" row - starts empty
  const [newItemLabel, setNewItemLabel] = useState("");
  // color/icon selector state - falls back to index 0 / the first known icon
  // name if the block doesn't have one set yet (same fallback discovery.tsx
  // uses for rendering, kept consistent here)
  const [selectedColorIndex, setSelectedColorIndex] = useState(
    loaderData.discoveryBlock.color ?? 0
  );
  const [selectedIcon, setSelectedIcon] = useState(
    loaderData.discoveryBlock.icon ?? DISCOVERY_BLOCK_ICON_NAMES[0]
  );

  // same palette lookup as discovery.tsx's card - echoes this block's own
  // color throughout the edit screen (icon, progress bar, checklist).
  // Reads from selectedColorIndex (state), not loaderData directly, so
  // picking a new swatch below updates this preview live, before Save is
  // even clicked.
  const discoveryBlockColor =
    CATEGORY_COLOR_PALETTE[selectedColorIndex] ?? CATEGORY_COLOR_PALETTE[0];
  const SelectedDiscoveryBlockIcon =
    DISCOVERY_BLOCK_ICON[selectedIcon] ?? DISCOVERY_BLOCK_DEFAULT_ICON;

  // same tinted checkbox as discovery.tsx's cards - shared builder now,
  // was duplicated as an inline object here before
  const checklistCheckboxTheme =
    buildCategoryCheckboxTheme(discoveryBlockColor);

  const itemsDoneCount = items.filter((item) => item.isChecked).length;
  const itemsTotalCount = items.length;
  const itemsDonePercent =
    itemsTotalCount === 0
      ? 0
      : Math.round((itemsDoneCount / itemsTotalCount) * 100);

  // declared inside the component (not at module scope) because it reads
  // params/title/description/notes - all local to this function's own
  // execution, not visible from outside it.
  // try/catch added here (previously missing - an unhandled rejection on
  // failure, nothing shown, nothing logged) once a real gap was found: the
  // toast system doesn't exist on our branch yet (see
  // feat(TR-45)/projects-list-and-create-project-fixes for Andrei/Carlos's
  // build of it, not merged), so this only logs for now - the commented
  // line below is the exact call to swap in once ToastProvider/useToast
  // land on main and this route is wrapped by it.
  // wraps router.invalidate() so a failure in IT can never be mistaken for
  // a failure of the mutation that just succeeded - a real bug hit here:
  // invalidate() was awaited inside the same try block as a mutation, so
  // any error from invalidate() alone landed in the catch and rolled back
  // an already-successful color/icon change, undoing a save that had
  // actually worked. Errors from refreshing the OTHER page's cache
  // shouldn't affect whether THIS page's save is considered successful -
  // called after the try/catch of every mutation below, never inside it.
  async function safeInvalidateRouter(): Promise<void> {
    try {
      await router.invalidate();
    } catch (error) {
      console.error("Failed to refresh cached route data", error);
    }
  }

  async function handleSave(): Promise<void> {
    try {
      // only title/description/notes here - color/icon are autosaved
      // separately (see handleColorChange/handleIconChange below), sending
      // them again here would be harmless today but is redundant, and
      // keeps this call scoped to exactly what "Save Changes" is for
      await updateDiscoveryBlock(params.projectId, params.discoveryBlockId, {
        title: title,
        description: description,
        notes: notes,
      });
    } catch (error) {
      console.error("Failed to save discovery block", error);
      // const { showToast } = useToast();
      // showToast({ type: "error", message: error instanceof Error ? error.message : "Failed to save category" });
      return;
    }
    // the /discovery list page's loader is cached by the router and
    // doesn't automatically refetch on a plain back-navigation - without
    // this, the card there can show stale data until a hard reload. Same
    // pattern Andrei/Carlos use after createProject/deleteProject.
    await safeInvalidateRouter();
  }

  // color/icon autosave on click - same optimistic pattern as the checkbox
  // toggle: update local state immediately (live preview), PATCH in the
  // background, roll back to the previous value on failure. Deliberately
  // NOT bundled with handleSave: clicking a swatch is a discrete action
  // like a checkbox, unlike Title/Description/Notes which need a real
  // "saving..." status indicator before autosave-while-typing is safe
  // (see the standing checklist item on this).
  async function handleColorChange(newColorIndex: number): Promise<void> {
    const previousColorIndex = selectedColorIndex;
    setSelectedColorIndex(newColorIndex);
    try {
      await updateDiscoveryBlock(params.projectId, params.discoveryBlockId, {
        color: newColorIndex,
      });
    } catch (error) {
      console.error("Failed to save discovery block color", error);
      // showToast({ type: "error", message: error instanceof Error ? error.message : "Failed to save color" });
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
      // showToast({ type: "error", message: error instanceof Error ? error.message : "Failed to save icon" });
      setSelectedIcon(previousIcon);
      return;
    }
    await safeInvalidateRouter();
  }

  // creates the item on the backend first, then appends the real returned
  // item (with its real id) to local state - not an optimistic update like
  // the checkbox toggle, since we need the backend-assigned id before this
  // item can be deleted or (later) toggled
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
      // showToast({ type: "error", message: error instanceof Error ? error.message : "Failed to add item" });
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
      // showToast({ type: "error", message: error instanceof Error ? error.message : "Failed to delete item" });
      return;
    }
    await safeInvalidateRouter();
  }

  // same optimistic-update pattern as discovery.tsx's checkbox toggle:
  // flip isChecked locally first, PATCH in the background, roll back on
  // failure - duplicated rather than shared, since this file and
  // discovery.tsx aren't importing from each other today (see the "does this
  // deserve a shared helper" question flagged in the standing item list)
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
      // showToast({ type: "error", message: error instanceof Error ? error.message : "Failed to update item" });
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

  return (
    <div className="flex flex-col gap-6">
      {/* header: Back link (left) + title (center-left) + Save button (right) -
        matches Figma's edit screen header, replacing the old bottom-of-page
        Save button. flex-wrap + gap-3 (not just justify-between): on narrow
        screens "Back | Edit Category" plus the button no longer fit on one
        line, this lets the button wrap to its own row instead of
        overflowing/clipping. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/$projectId/discovery"
            params={{ projectId: params.projectId }}
            className="flex items-center gap-1 text-sm text-text-secondary no-underline hover:text-text-primary"
          >
            <HiArrowLeft />
            Back
          </Link>
          <span className="text-surface-border">|</span>
          <div className="flex items-center gap-2">
            {/* icon box tinted with this block's own color (badgeBg/text),
            same convention as the card's icon circle on discovery.tsx,
            instead of a fixed brand color regardless of category. Renders
            the currently *selected* icon (state), not just the saved one -
            live preview while picking below, same as discoveryBlockColor. */}
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

      {/* 2-column grid on wide screens (fields left, checklist right, per
        Figma) - single column on narrow screens (grid-cols-1 default,
        lg:grid-cols-2 only kicks in above the lg breakpoint) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
              Color
            </Label>
            {/* 8 swatches, one per CATEGORY_COLOR_PALETTE entry - the
            selected one gets a ring in its own color + a checkmark, same
            "you can tell what's picked without relying on color alone"
            reasoning as an accessible radio group */}
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORY_COLOR_PALETTE.map((color, colorIndex) => {
                return (
                  <button
                    key={colorIndex}
                    type="button"
                    aria-label={"Color " + (colorIndex + 1)}
                    aria-pressed={colorIndex === selectedColorIndex}
                    onClick={() => void handleColorChange(colorIndex)}
                    className={
                      color.bg +
                      " flex h-8 w-8 items-center justify-center rounded-full text-white" +
                      (colorIndex === selectedColorIndex
                        ? " ring-2 ring-offset-2 ring-offset-surface-base " +
                          color.ring
                        : "")
                    }
                  >
                    {colorIndex === selectedColorIndex && <HiCheck />}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
              Icon
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISCOVERY_BLOCK_ICON_NAMES.map((iconName) => {
                const IconOption = DISCOVERY_BLOCK_ICON[iconName];
                const isSelected = iconName === selectedIcon;
                return (
                  <button
                    key={iconName}
                    type="button"
                    aria-label={iconName + " icon"}
                    aria-pressed={isSelected}
                    onClick={() => void handleIconChange(iconName)}
                    className={
                      "flex h-8 w-8 items-center justify-center rounded-full border " +
                      (isSelected
                        ? discoveryBlockColor.bg +
                          " text-white " +
                          discoveryBlockColor.border
                        : "border-surface-border bg-surface-overlay text-text-secondary dark:border-surface-border dark:bg-surface-overlay")
                    }
                  >
                    <IconOption />
                  </button>
                );
              })}
            </div>
          </div>
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
              // matches CreateDiscoveryBlockDto's @MaxLength - without this,
              // typing past the limit then saving would fail with no
              // feedback shown at all (no toast/notification system yet)
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
          {/* progress summary - same "X / Y completed" + percent + bar
          layout as the Overall Progress card on discovery.tsx, tinted with
          this block's own color instead of brand green */}
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

          <Label className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
            Checklist
          </Label>
          <div className="mt-2 flex flex-col gap-2">
            {/* each item is its own rounded-border "pill" (per Figma),
            not a plain row - checkbox + label + delete button. Checked
            items get a strikethrough on the label (line-through), same
            visual convention as most checklist UIs. */}
            {items.map((item) => {
              return (
                <div
                  key={item.id}
                  className={
                    "flex items-center gap-3 rounded-lg border px-4 py-3 " +
                    discoveryBlockColor.subtleBg +
                    " " +
                    discoveryBlockColor.border
                  }
                >
                  <Checkbox
                    className="h-4 w-4 shrink-0"
                    theme={checklistCheckboxTheme}
                    checked={item.isChecked}
                    onChange={() => void handleToggleItem(item)}
                    aria-label={item.label}
                  />
                  {/* min-w-0 + truncate: same overflow fix as ProjectCard.tsx
                  on Carlos's PR #18 - a long, space-less label inside a flex
                  row can grow past the pill's width instead of being clipped,
                  min-w-0 lets it actually shrink so truncate can take effect */}
                  <span
                    className={
                      "min-w-0 flex-1 truncate text-sm text-text-primary" +
                      (item.isChecked
                        ? " text-text-secondary line-through"
                        : "")
                    }
                    title={item.label}
                  >
                    {item.label}
                  </span>
                  <button
                    type="button"
                    aria-label={"Remove " + item.label}
                    onClick={() => void handleRemoveItem(item.id)}
                    className="text-text-secondary hover:text-control-error"
                  >
                    <HiX />
                  </button>
                </div>
              );
            })}
            {/* add-new-item row: styled as the same rounded pill as the
            items above it, so it reads as "part of the list" rather than a
            separate form - Enter in the input does the same as clicking + */}
            <div className="flex items-center gap-2">
              <TextInput
                theme={darkSurfaceTextInputTheme}
                placeholder="New item..."
                // placeholder alone isn't an accessible name (it disappears
                // once text is typed, and some screen readers never
                // announce it at all) - no visible <Label> here since the
                // "Checklist" heading above already establishes context,
                // so aria-label carries the accessible name instead
                aria-label="New checklist item"
                // matches CreateDiscoveryBlockItemDto's @MaxLength - same
                // reasoning as the Title/Description/Notes fields above
                maxLength={DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH}
                value={newItemLabel}
                onChange={(event) => setNewItemLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAddItem();
                  }
                }}
                className="flex-1"
              />
              {/* focus:ring-green-300, not Flowbite's default blue ring -
              same fix already applied to the Save Changes button above */}
              <Button
                aria-label="Add item"
                className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
                onClick={() => void handleAddItem()}
              >
                <HiPlus />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
