// Search results page (/search).
// Full-page results view with filter tabs: All / Projects / Tickets / Members / Pages.
// The quick-search dropdown in the header is a separate component (not a route) - it links here via "See all results".
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();

  return (
    <section className="p-6 text-text-primary">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-500">
        Workspace search
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {q ? `Results for "${q}"` : "Search the workspace"}
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Project, ticket, member, and page results will be collected here.
      </p>
    </section>
  );
}
