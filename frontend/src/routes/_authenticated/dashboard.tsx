import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return <div className="text-brand-700">Hello "/dashboard"!</div>;	// random color, don't pay attention
}
