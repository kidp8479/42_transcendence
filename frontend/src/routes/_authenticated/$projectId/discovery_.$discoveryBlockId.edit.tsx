import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  getDiscoveryBlock,
  updateDiscoveryBlock,
  parseDiscoveryBlock,
  DISCOVERY_BLOCK_TITLE_MAX_LENGTH,
  DISCOVERY_BLOCK_DESCRIPTION_MAX_LENGTH,
  DISCOVERY_BLOCK_NOTES_MAX_LENGTH,
} from "@/lib/discoveryBlocks";
import {
  listDiscoveryBlockItems,
  createDiscoveryBlockItem,
  updateDiscoveryBlockItem,
  deleteDiscoveryBlockItem,
  parseDiscoveryBlockItem,
  type DiscoveryBlockItem,
} from "@/lib/discoveryBlockItems";
import { getRealtimeSocket } from "@/lib/realtimeSocket";
import { ApiError } from "@/lib/apiClient";
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
import { useFieldLock } from "@/hooks/useFieldLock";
import { useLiveItemSync } from "@/hooks/useLiveItemSync";
import { LockOwnerAvatar } from "@/components/LockOwnerAvatar";

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
  const {
    lock: editingLock,
    isLockedByOther,
    leaseToken,
    leaseLost,
    acquire: acquireFieldLock,
    release: releaseFieldLock,
  } = useFieldLock(
    params.projectId,
    `discovery-block:${params.discoveryBlockId}`
  );

  // Lock is claimed on the first real interaction (focusing a text field,
  // clicking a color/icon swatch), not just from opening the screen -
  // merely viewing a block shouldn't block everyone else out of it.
  // useFieldLock's own effect still does a passive field:query on mount, so
  // isLockedByOther/editingLock are accurate immediately even before this
  // user tries to edit anything.
  const [isAcquiringLock, setIsAcquiringLock] = useState(false);

  // Checks "do I currently hold the lock" via isLockedByOther (kept live by
  // field:locked/unlocked broadcasts, scoped to this socket - not just this
  // account, since two tabs signed into the same account are two different
  // sockets) rather than a one-shot "already tried" flag - a flag would
  // skip re-acquiring after this same user saves (releasing the lock) and
  // then edits again on the same page load, or after losing an acquire
  // race once and the other holder later releases it.
  async function ensureLock(): Promise<string | null> {
    if (editingLock !== null && !isLockedByOther && leaseToken !== null) {
      return leaseToken;
    }
    setIsAcquiringLock(true);
    const granted = await acquireFieldLock();
    setIsAcquiringLock(false);
    return granted;
  }

  // Fields stay read-only while someone else holds the lock, or during the
  // brief round trip after this user's first interaction while the server
  // confirms the lock is actually theirs (same race the checklist item fix
  // covers - the server can still refuse even if isLockedByOther looked
  // false locally).
  const fieldsDisabled = isLockedByOther || isAcquiringLock;

  // Escape goes back to the Discovery list, same target as the Back link
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // stopPropagation so Escape only leaves this edit screen - without
        // it the event still bubbles to SideBarCmp's own window-level
        // Escape listener, which collapses the sidebar at the same time.
        event.stopPropagation();
        void navigate({
          to: "/$projectId/discovery",
          params: { projectId: params.projectId },
        });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, params.projectId]);

  const [title, setTitle] = useState(loaderData.discoveryBlock.title);
  const [description, setDescription] = useState(
    loaderData.discoveryBlock.description ?? ""
  );
  const [notes, setNotes] = useState(loaderData.discoveryBlock.notes ?? "");
  const [items, setItems] = useState<DiscoveryBlockItem[]>(loaderData.items);
  const [newItemLabel, setNewItemLabel] = useState("");

  // useState's initial value only seeds the first mount - if this route's
  // component survives a visit without remounting, items would otherwise
  // stay stuck on stale data even though the loader keeps re-fetching.
  // Same pattern as discovery.tsx's own loaderData sync, scoped to items
  // only: title/description/notes are excluded so an unrelated invalidate
  // (toggling a checkbox) can't blow away unsaved text in those fields.
  useEffect(() => {
    setItems(loaderData.items);
  }, [loaderData]);

  // live sync: another member checking/unchecking, adding, or removing an
  // item on this same block updates it here without a reload - scoped to
  // this block, other Discovery blocks' item events are ignored
  useLiveItemSync("discovery-item", parseDiscoveryBlockItem, setItems, {
    value: params.discoveryBlockId,
    getValue: (item) => item.discoveryBlockId,
  });

  const [selectedColorIndex, setSelectedColorIndex] = useState(
    loaderData.discoveryBlock.color ?? 0
  );
  const [selectedIcon, setSelectedIcon] = useState(
    loaderData.discoveryBlock.icon ?? DISCOVERY_BLOCK_ICON_NAMES[0]
  );

  // live sync: another member saving Title/Description/Notes, or changing
  // the color/icon, updates this screen without a reload.
  //
  // Title/Description/Notes are only applied when this user does NOT hold
  // the lock. Holding the lock is what makes handleColorChange/
  // handleIconChange PATCH color or icon alone (not the whole form) - the
  // backend still returns and broadcasts the full row, including whatever
  // title/description/notes are currently persisted (not this user's own
  // unsaved typing). Applying those fields to the lock holder's own screen
  // would silently revert their in-progress edit on every color/icon click.
  // Color/icon are always safe to apply: they're single-click autosaves,
  // never a multi-keystroke edit that could be "unsaved" underneath us.
  useEffect(() => {
    const socket = getRealtimeSocket();

    function handleBlockUpdated(payload: unknown) {
      const updatedBlock = parseDiscoveryBlock(payload);
      if (
        updatedBlock === null ||
        updatedBlock.id !== params.discoveryBlockId
      ) {
        return;
      }
      const holdsLockMyself = editingLock !== null && !isLockedByOther;
      if (!holdsLockMyself) {
        setTitle(updatedBlock.title);
        setDescription(updatedBlock.description ?? "");
        setNotes(updatedBlock.notes ?? "");
      }
      setSelectedColorIndex(updatedBlock.color ?? 0);
      setSelectedIcon(updatedBlock.icon ?? DISCOVERY_BLOCK_ICON_NAMES[0]);
    }

    socket.on("discovery-block:updated", handleBlockUpdated);
    return () => {
      socket.off("discovery-block:updated", handleBlockUpdated);
    };
  }, [params.discoveryBlockId, editingLock, isLockedByOther]);

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

  // same "unchecked items first" sort as the card preview (DiscoveryBlockCard.tsx),
  // so both screens show items in the same order. A copy since .sort() mutates
  // in place, and handleAddItem below relies on items.length (creation order)
  // for the new item's position - not sortedItems
  const sortedItems = [...items].sort((a, b) => {
    if (a.isChecked === b.isChecked) {
      return 0;
    }
    return a.isChecked ? 1 : -1;
  });

  async function handleSave(): Promise<void> {
    // the backend trims title server-side (CreateDiscoveryBlockDto's
    // @Transform) - trimmed here too so the input reflects what actually
    // got saved, since title isn't resynced from loaderData after invalidate
    const trimmedTitle = title.trim();
    const fieldLockToken = await ensureLock();
    if (fieldLockToken === null) {
      return;
    }
    try {
      // color/icon are autosaved separately (handleColorChange/
      // handleIconChange below) - not sent again here
      await updateDiscoveryBlock(
        params.projectId,
        params.discoveryBlockId,
        {
          title: trimmedTitle,
          description: description,
          notes: notes,
        },
        fieldLockToken
      );
    } catch (error) {
      console.error("Failed to save discovery block", error);
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to save category",
      });
      return;
    }
    setTitle(trimmedTitle);
    await safeInvalidateRouter();
    showToast({ type: "success", message: "Changes saved" });
    releaseFieldLock();
  }

  // color/icon autosave on click, same optimistic pattern as the checkbox
  // toggle below - a discrete click, unlike Title/Description/Notes which
  // need a real "saving..." indicator before autosave-while-typing is safe
  async function handleColorChange(newColorIndex: number): Promise<void> {
    const fieldLockToken = await ensureLock();
    if (fieldLockToken === null) {
      return;
    }
    const previousColorIndex = selectedColorIndex;
    setSelectedColorIndex(newColorIndex);
    try {
      await updateDiscoveryBlock(
        params.projectId,
        params.discoveryBlockId,
        {
          color: newColorIndex,
        },
        fieldLockToken
      );
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
    const fieldLockToken = await ensureLock();
    if (fieldLockToken === null) {
      return;
    }
    const previousIcon = selectedIcon;
    setSelectedIcon(newIcon);
    try {
      await updateDiscoveryBlock(
        params.projectId,
        params.discoveryBlockId,
        {
          icon: newIcon,
        },
        fieldLockToken
      );
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
      // the discovery-item:created broadcast (see handleItemCreated above)
      // can land on this same client before this request's own response
      // does - same dedup check on both sides so whichever arrives first
      // wins, the second is a no-op instead of a duplicate row
      setItems((previousItems) =>
        previousItems.some((item) => item.id === createdItem.id)
          ? previousItems
          : [...previousItems, createdItem]
      );
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
    } catch (error) {
      // a 404 here means someone else already deleted this item (race
      // between two members both clicking delete) - the row disappearing
      // is exactly what this user wanted too, so treat it as success
      // instead of showing an error for an outcome they actually asked for
      if (!(error instanceof ApiError && error.status === 404)) {
        console.error("Failed to delete discovery block item", error);
        showToast({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to delete item",
        });
        return;
      }
    }
    setItems((previousItems) => previousItems.filter((item) => item.id !== id));
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

  return (
    <div className="flex flex-col gap-6">
      {/* flex-wrap: on narrow screens "Back | Edit Category" + the button
      no longer fit on one line, lets the button wrap instead of overflowing */}
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
          disabled={fieldsDisabled}
        >
          Save Changes
        </Button>
      </div>

      {isLockedByOther && editingLock && (
        <div
          className={
            "flex items-center gap-2 rounded-lg border-2 bg-surface-raised px-4 py-2 text-sm text-text-secondary " +
            discoveryBlockColor.border
          }
        >
          <LockOwnerAvatar
            username={editingLock.username}
            avatarUrl={editingLock.avatarUrl}
          />
          <span>
            <span className="font-semibold text-text-primary">
              {editingLock.username}
            </span>{" "}
            is editing this category right now - you'll be able to make changes
            once they save.
          </span>
        </div>
      )}

      {leaseLost && !isLockedByOther && (
        <p className="text-sm text-control-error" role="status">
          Connection lost. Your unsaved changes are preserved; saving will
          acquire a new editing lease.
        </p>
      )}

      {/* single column below lg, 2 columns above (fields left, checklist right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <DiscoveryBlockAppearancePicker
            selectedColorIndex={selectedColorIndex}
            selectedIcon={selectedIcon}
            discoveryBlockColor={discoveryBlockColor}
            onColorChange={(colorIndex) => void handleColorChange(colorIndex)}
            onIconChange={(iconName) => void handleIconChange(iconName)}
            disabled={fieldsDisabled}
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
              onFocus={() => void ensureLock()}
              readOnly={fieldsDisabled}
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
              onFocus={() => void ensureLock()}
              readOnly={fieldsDisabled}
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
              onFocus={() => void ensureLock()}
              readOnly={fieldsDisabled}
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
            onToggleItem={(item) => void handleToggleItem(item)}
            onRemoveItem={(id) => void handleRemoveItem(id)}
            onAddItem={() => void handleAddItem()}
          />
        </div>
      </div>
    </div>
  );
}
