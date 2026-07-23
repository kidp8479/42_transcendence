import { createFileRoute } from "@tanstack/react-router";
import { listDiscoveryBlocks } from "@/lib/discoveryBlocks";

export const Route = createFileRoute("/_authenticated/$projectId/discovery")({
  loader: (routeContext) => listDiscoveryBlocks(routeContext.params.projectId),
  component: DiscoveryPage,
});

function DiscoveryPage() {
  const discoveryBlocks = Route.useLoaderData();

  return (
    <div>
      {discoveryBlocks.map((discoveryBlock) => (
        <div key={discoveryBlock.id}>{discoveryBlock.title}</div>
      ))}
    </div>
  );
}
