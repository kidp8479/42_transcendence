import type { ErrorComponentProps } from "@tanstack/react-router";
import { ApiError } from "@/lib/apiClient";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";

// Bubbles up from any route's loader/component that doesn't define its own
// errorComponent - mounted once on __root.tsx, covers every route in the app.
export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const message = buildErrorMessage(error);
  const safeInvalidateRouter = useSafeRouterInvalidate();

  // reset() alone only clears this boundary's local error state - it never
  // re-runs the loader that actually failed. router.invalidate() is what
  // retries it, and it has to run and settle BEFORE reset(): reset() is what
  // makes this boundary re-render its children on the next tick, so if it
  // fires first, that re-render happens against the still-stale (pre-retry)
  // route match and nothing catches the loader's later, separate failure -
  // the screen just goes blank instead of showing the error again.
  async function handleRetry(): Promise<void> {
    await safeInvalidateRouter();
    reset();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      {/* same color tokens as the error toast (ToastProvider.tsx) - full-page
      and centered instead of a corner popup, since this replaces a page that
      failed to load rather than reacting to a transient action */}
      <div
        role="alert"
        className="flex max-w-md flex-col items-center gap-3 rounded-lg border border-control-error bg-red-950 p-6 text-center text-red-100 shadow-lg"
      >
        <p className="font-mono text-lg font-semibold">Something went wrong</p>
        <p className="text-sm">{message}</p>
        <button
          type="button"
          onClick={() => void handleRetry()}
          className="rounded-md border border-red-100 px-4 py-2 text-sm font-medium hover:bg-red-900"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// ApiError already carries the real backend message (see apiClient.ts) - the
// status-specific branches below only override it where a generic backend
// message would be confusing out of context (ex: a raw "Not found" with no
// mention of what wasn't found).
function buildErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return "This page could not be found.";
    }
    if (error.status === 401 || error.status === 403) {
      return "You don't have access to this page.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred.";
}
