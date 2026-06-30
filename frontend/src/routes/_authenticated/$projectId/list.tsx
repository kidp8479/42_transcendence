import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$projectId/list")({
  component: ListPage,
});

function ListPage() {
  return <div>Hello "/_authenticated/_projects/list"!</div>;
}
