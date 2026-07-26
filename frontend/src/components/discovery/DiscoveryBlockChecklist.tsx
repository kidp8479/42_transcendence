import { Label, TextInput, Button, Checkbox } from "flowbite-react";
import { HiX, HiPlus } from "react-icons/hi";
import type { DiscoveryBlockItem } from "@/lib/discoveryBlockItems";
import { DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH } from "@/lib/discoveryBlockItems";
import {
  darkSurfaceTextInputTheme,
  type buildCategoryCheckboxTheme,
} from "@/lib/flowbite";
import type { CategoryColor } from "@/lib/categoryColorPalette";

interface DiscoveryBlockChecklistProps {
  items: DiscoveryBlockItem[];
  discoveryBlockColor: CategoryColor;
  checklistCheckboxTheme: ReturnType<typeof buildCategoryCheckboxTheme>;
  newItemLabel: string;
  onNewItemLabelChange: (value: string) => void;
  onToggleItem: (item: DiscoveryBlockItem) => void;
  onRemoveItem: (id: string) => void;
  onAddItem: () => void;
}

// checklist section of the edit screen: each item is its own rounded-border
// "pill" (per Figma) - checkbox + label + delete button, checked items get
// a strikethrough - plus a "New item..." row styled the same way at the bottom
export function DiscoveryBlockChecklist({
  items,
  discoveryBlockColor,
  checklistCheckboxTheme,
  newItemLabel,
  onNewItemLabelChange,
  onToggleItem,
  onRemoveItem,
  onAddItem,
}: DiscoveryBlockChecklistProps) {
  return (
    <div>
      <Label className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
        Checklist
      </Label>
      <div className="mt-2 flex flex-col gap-2">
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
                onChange={() => onToggleItem(item)}
                aria-label={item.label}
              />
              {/* min-w-0 + truncate: a long, space-less label can grow past
              the pill's width instead of being clipped otherwise (same fix
              as ProjectCard.tsx on PR #18) */}
              <span
                className={
                  "min-w-0 flex-1 truncate text-sm text-text-primary" +
                  (item.isChecked ? " text-text-secondary line-through" : "")
                }
                title={item.label}
              >
                {item.label}
              </span>
              <button
                type="button"
                aria-label={"Remove " + item.label}
                onClick={() => onRemoveItem(item.id)}
                className="text-text-secondary hover:text-control-error"
              >
                <HiX />
              </button>
            </div>
          );
        })}
        <div className="flex items-center gap-2">
          <TextInput
            theme={darkSurfaceTextInputTheme}
            placeholder="New item..."
            // no visible <Label> here (the "Checklist" heading above already
            // gives context) - placeholder alone isn't a reliable accessible
            // name, aria-label carries it instead
            aria-label="New checklist item"
            maxLength={DISCOVERY_BLOCK_ITEM_LABEL_MAX_LENGTH}
            value={newItemLabel}
            onChange={(event) => onNewItemLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddItem();
              }
            }}
            className="flex-1"
          />
          <Button
            aria-label="Add item"
            className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
            onClick={onAddItem}
          >
            <HiPlus />
          </Button>
        </div>
      </div>
    </div>
  );
}
