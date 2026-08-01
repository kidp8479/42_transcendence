import { Label } from "flowbite-react";
import { HiCheck } from "react-icons/hi";
import {
  CATEGORY_COLOR_PALETTE,
  type CategoryColor,
} from "@/lib/categoryColorPalette";
import {
  DISCOVERY_BLOCK_ICON,
  DISCOVERY_BLOCK_ICON_NAMES,
} from "@/lib/discoveryBlockIcons";

interface DiscoveryBlockAppearancePickerProps {
  selectedColorIndex: number;
  selectedIcon: string;
  discoveryBlockColor: CategoryColor;
  onColorChange: (colorIndex: number) => void;
  onIconChange: (iconName: string) => void;
  // same gating as Title/Description/Notes on the edit screen - a locked
  // block's color/icon shouldn't be changeable by anyone but the lock holder
  disabled: boolean;
}

// color swatches + icon buttons on the edit screen - both autosave on click
// (see the route's handleColorChange/handleIconChange), the selected one
// gets a ring/fill in its own color plus a checkmark, so the choice doesn't
// rely on color alone
export function DiscoveryBlockAppearancePicker({
  selectedColorIndex,
  selectedIcon,
  discoveryBlockColor,
  onColorChange,
  onIconChange,
  disabled,
}: DiscoveryBlockAppearancePickerProps) {
  return (
    <>
      <div>
        <Label className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
          Color
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORY_COLOR_PALETTE.map((color, colorIndex) => {
            return (
              <button
                key={colorIndex}
                type="button"
                aria-label={"Color " + (colorIndex + 1)}
                aria-pressed={colorIndex === selectedColorIndex}
                onClick={() => onColorChange(colorIndex)}
                disabled={disabled}
                className={
                  color.bg +
                  " flex h-8 w-8 items-center justify-center rounded-full text-white disabled:opacity-50" +
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
                onClick={() => onIconChange(iconName)}
                disabled={disabled}
                className={
                  "flex h-8 w-8 items-center justify-center rounded-full border disabled:opacity-50" +
                  (isSelected
                    ? " " +
                      discoveryBlockColor.bg +
                      " text-white " +
                      discoveryBlockColor.border
                    : " border-surface-border bg-surface-overlay text-text-secondary dark:border-surface-border dark:bg-surface-overlay")
                }
              >
                <IconOption />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
