// Entry point for the _authenticated/ folder.
// TanStack Router requires a route.tsx inside each folder to treat it as a layout route.
// Without this file, _authenticated/ is just a folder - the router ignores it entirely.
// This file makes _authenticated/ a pathless layout - its name does not appear in the URL.
// Every page inside _authenticated/ (dashboard, projects...) is automatically wrapped by AuthenticatedLayout.
// The auth guard runs before any _authenticated/ page renders - redirects to / if not logged in.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { ApiError } from "@/lib/apiClient";
import { listProjects } from "@/lib/projectsApi";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context }) => {
    if (context.authState.status !== "authenticated") {
      throw redirect({ to: "/" });
    }
    return { session: context.authState.session };
  },
  // Load projects once at the authenticated layout boundary so the sidebar can
  // render real data on every private page without duplicating fetch logic.
  loader: async () => {
    try {
      return await listProjects();
    } catch (error) {
      // If session expires between root auth check and loader execution,
      // recover with a safe redirect instead of rendering a broken sidebar.
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: "/" });
      }
      throw error;
    }
  },
  component: AuthenticatedLayout,
});
