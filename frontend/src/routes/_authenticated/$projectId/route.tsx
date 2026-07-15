// Entry point for the $projectId/ folder.
// Wraps all project tab pages (summary, kanban, list...) in ProjectLayout.
// Redirects to /summary if the user lands on /:projectId directly (no tab selected).
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectLayout } from "@/components/layout/ProjectLayout";

export const Route = createFileRoute("/_authenticated/$projectId")({
  beforeLoad: ({ location, params }) => {
    if (location.pathname === `/${params.projectId}`) {
      throw redirect({ to: "/$projectId/summary", params });
    }
  },
  // loader: runs before the route renders, result available to any child
  // component via useLoaderData({ from: "/_authenticated/$projectId" }).
  // credentials: "include" sends the HttpOnly session cookie set by the auth
  // service - needed even though frontend and API share an origin through
  // nginx, since the browser doesn't send cookies on fetch() by default.
  loader: async ({ params }) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/projects/${params.projectId}`,
      { credentials: "include" }
    );
    if (!res.ok) {
      throw new Error(`Failed to load project ${params.projectId}`);
    }
    return res.json();
  },
  component: ProjectLayout,
});
