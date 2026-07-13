import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$projectId/summary")({
  component: SummaryPage,
});

function SummaryPage() {
  /*   const summary_json_mock_up = {
    ticketsByStatus: {
      TODO: 6,
      IN_PROGRESS: 5,
      REVIEW: 2,
      COMPLETED: 8,
    },
  }; */

  return <div>Hello "/$projectId/summary"!</div>;
}
