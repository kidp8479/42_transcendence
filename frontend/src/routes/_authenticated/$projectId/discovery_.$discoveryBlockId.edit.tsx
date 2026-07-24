import { createFileRoute } from "@tanstack/react-router";
import { getDiscoveryBlock } from "@/lib/discoveryBlocks";

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
  return (
    <>
      <div>{discoveryBlock.title}</div>
      <div>
        {discoveryBlock.description && <p>{discoveryBlock.description}</p>}
      </div>
      <div>{discoveryBlock.notes && <p>{discoveryBlock.notes}</p>}</div>
    </>
  );
}
