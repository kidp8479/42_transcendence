import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/project-settings")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authenticated/project-settings"!</div>;
}
