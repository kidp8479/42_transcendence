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

// Icon per icon name - mirrors CreateDiscoveryBlockDto's DISCOVERY_BLOCK_ICON_NAMES
// on the backend (@IsIn-validated there, kept in sync manually here). Record
// rather than an exhaustive type: an unknown/missing name falls back to
// DISCOVERY_BLOCK_DEFAULT_ICON instead of being a compile-time error.
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
