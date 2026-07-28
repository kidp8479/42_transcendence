// 404 catch-all route (any URL that doesn't match any other route).
// Displayed when the user navigates to a URL that doesn't exist.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  component: NotFoundPage,
});

function NotFoundPage() {
  // Renders straight into the app shell, with no layout in between - so
  // unlike every other page it has to own its scroller.
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      404 - Page not found
    </div>
  );
}
