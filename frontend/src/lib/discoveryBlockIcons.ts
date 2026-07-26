// Shared between discovery.tsx (card icon) and the DiscoveryBlock edit
// screen (icon selector) - extracted here instead of duplicating this map a
// 2nd time, same reasoning as the shared CATEGORY_COLOR_PALETTE.
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

// Icon per icon name - matches the free-text names stored in seed.ts
// ("search", "layers", ...). Not an exhaustive Record: DiscoveryBlock.icon
// is a free string on the backend (no fixed set yet, see the DTO's own
// comment), so an unknown/missing name falls back to DISCOVERY_BLOCK_DEFAULT_ICON
// instead of being a compile-time error.
export const DISCOVERY_BLOCK_ICON: Record<string, IconType> = {
  search: HiSearch,
  layers: HiCollection,
  palette: HiColorSwatch,
  link: HiLink,
  notebook: HiBookOpen,
  wheel: HiCog,
};

// the known icon names, in a fixed order - used by the edit screen's icon
// selector to render one button per option
export const DISCOVERY_BLOCK_ICON_NAMES = Object.keys(DISCOVERY_BLOCK_ICON);

export const DISCOVERY_BLOCK_DEFAULT_ICON = HiOutlineFolder;
