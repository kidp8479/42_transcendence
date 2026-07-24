import { createFileRoute } from "@tanstack/react-router";
import { getDiscoveryBlock } from "@/lib/discoveryBlocks";
import { useState } from "react";
import { Label, TextInput, Textarea } from "flowbite-react";

// trailing underscore in "discovery_" opts this route out of nesting under
// discovery.tsx (which has no <Outlet/>, so a nested child would never render)
export const Route = createFileRoute(
  "/_authenticated/$projectId/discovery_/$discoveryBlockId/edit"
)({
  // fetches just the one block this screen edits, using both URL params
  loader: (routeContext) =>
    getDiscoveryBlock(
      routeContext.params.projectId,
      routeContext.params.discoveryBlockId
    ),
  component: DiscoveryBlockEditPage,
});

function DiscoveryBlockEditPage() {
  // data from the loader - the block as it currently is in the database
  const discoveryBlock = Route.useLoaderData();

  // local editable state, seeded from the loader's data. Changing these
  // (via setTitle/setDescription/setNotes) re-renders this component with
  // the new value - discoveryBlock itself never changes, only these do.
  const [title, setTitle] = useState(discoveryBlock.title);
  const [description, setDescription] = useState(
    discoveryBlock.description ?? ""
  );
  const [notes, setNotes] = useState(discoveryBlock.notes ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="discovery-block-title">Title</Label>
        <TextInput
          id="discovery-block-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="discovery-block-description">Description</Label>
        <Textarea
          id="discovery-block-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="discovery-block-notes">Notes</Label>
        <Textarea
          id="discovery-block-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
    </div>
  );
}
