// 404 catch-all route (any URL that doesn't match any other route).
// Displayed when the user navigates to a URL that doesn't exist.
import { createFileRoute } from "@tanstack/react-router";
import { ErrorScreen } from "@/components/errors/ErrorScreen";

export const Route = createFileRoute("/$")({
  component: NotFoundPage,
});

function NotFoundPage() {
  return (
    <ErrorScreen
      title="Page not found"
      message="This page could not be found."
      showGoHome
    />
  );
}
