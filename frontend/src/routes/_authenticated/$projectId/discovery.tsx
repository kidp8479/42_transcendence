import { createFileRoute } from "@tanstack/react-router";
import { Badge, Card } from "flowbite-react";
import {
  listDiscoveryBlocks,
  type DiscoveryBlockStatus,
} from "@/lib/discoveryBlocks";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
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

export const Route = createFileRoute("/_authenticated/$projectId/discovery")({
  loader: (routeContext) => listDiscoveryBlocks(routeContext.params.projectId),
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

function DiscoveryPage() {
  const discoveryBlocks = Route.useLoaderData();
  return (
    <div className="flex flex-wrap gap-4">
      {discoveryBlocks.map((discoveryBlock) => {
        const discoveryBlockColor =
          CATEGORY_COLOR_PALETTE[discoveryBlock.color ?? 0] ??
          CATEGORY_COLOR_PALETTE[0];
        const DiscoveryBlockIcon =
          DISCOVERY_BLOCK_ICON[discoveryBlock.icon ?? ""] ?? HiOutlineFolder;
        return (
          <Card
            key={discoveryBlock.id}
            className="max-w-sm bg-surface-raised border-surface-border"
          >
            <div className={discoveryBlockColor.bg + " h-1.5"}></div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
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
            {discoveryBlock.description && (
              <p className="text-text-secondary text-sm">
                {discoveryBlock.description}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
