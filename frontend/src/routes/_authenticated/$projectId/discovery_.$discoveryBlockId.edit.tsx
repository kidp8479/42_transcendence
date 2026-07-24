import { createFileRoute, Link } from "@tanstack/react-router";
import { getDiscoveryBlock, updateDiscoveryBlock } from "@/lib/discoveryBlocks";
import { useState } from "react";
import { Label, TextInput, Textarea, Button } from "flowbite-react";
import { HiArrowLeft, HiDocumentText } from "react-icons/hi";
import {
  darkSurfaceFieldClassName,
  darkSurfaceTextInputTheme,
} from "@/lib/flowbite";

// trailing "_" opts out of nesting under discovery.tsx (no <Outlet/> there)
export const Route = createFileRoute(
  "/_authenticated/$projectId/discovery_/$discoveryBlockId/edit"
)({
  loader: (routeContext) =>
    getDiscoveryBlock(
      routeContext.params.projectId,
      routeContext.params.discoveryBlockId
    ),
  component: DiscoveryBlockEditPage,
});

function DiscoveryBlockEditPage() {
  const discoveryBlock = Route.useLoaderData();
  const params = Route.useParams();

  // editable local state, seeded from the loader's data
  const [title, setTitle] = useState(discoveryBlock.title);
  const [description, setDescription] = useState(
    discoveryBlock.description ?? ""
  );
  const [notes, setNotes] = useState(discoveryBlock.notes ?? "");

  // declared inside the component (not at module scope) because it reads
  // params/title/description/notes - all local to this function's own
  // execution, not visible from outside it
  async function handleSave(): Promise<void> {
    await updateDiscoveryBlock(
      params.projectId,
      params.discoveryBlockId,
      title,
      description,
      notes
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* header: Back link (left) + title (center-left) + Save button (right) -
        matches Figma's edit screen header, replacing the old bottom-of-page
        Save button */}
      <div className="flex items-center justify-between">
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
            <HiDocumentText className="text-brand-500" />
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

      {/* max-w-xl: without a cap, TextInput/Textarea stretch to fill the
        whole route's content area (both default to full width of their
        container) */}
      <div className="flex max-w-xl flex-col gap-4">
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
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
