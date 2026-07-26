import type { ErrorComponentProps } from "@tanstack/react-router";
import { ApiError } from "@/lib/apiClient";

// Bubbles up from any route's loader/component that doesn't define its own
// errorComponent - mounted once on __root.tsx, covers every route in the app.
export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const message = buildErrorMessage(error);

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
          onClick={reset}
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
