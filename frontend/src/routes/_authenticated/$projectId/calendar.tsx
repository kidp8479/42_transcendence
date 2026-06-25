import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$projectId/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  return <div>Hello "/_authenticated/_projects/calendar"!</div>;
}
