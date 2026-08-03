import type { ErrorComponentProps } from "@tanstack/react-router";
import { ApiError } from "@/lib/apiClient";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { ErrorScreen } from "./ErrorScreen";

// Bubbles up from any route's loader/component that doesn't define its own
// errorComponent - mounted once on __root.tsx, covers every route in the app.
export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const { message, action } = classifyError(error);
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
    <ErrorScreen
      message={message}
      onRetry={action === "retry" ? () => void handleRetry() : undefined}
      showGoHome={action === "navigate-home"}
    />
  );
}

// ApiError already carries the real backend message (see apiClient.ts) - the
// status-specific branches below only override it where a generic backend
// message would be confusing out of context (ex: a raw "Not found" with no
// mention of what wasn't found).
//
// "retry" reruns the same loader - correct for transient failures (network
// blip, a temporary 500). "navigate-home" is for errors where a retry would
// just fail again forever: any 4xx means this specific request is
// permanently invalid (resource gone, access revoked, a malformed id in the
// URL...), not something that becomes valid on a second try.
function classifyError(error: unknown): {
  message: string;
  action: "retry" | "navigate-home";
} {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return {
        message: "This page could not be found.",
        action: "navigate-home",
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        message: "You don't have access to this page.",
        action: "navigate-home",
      };
    }
    if (error.status >= 400 && error.status < 500) {
      return { message: error.message, action: "navigate-home" };
    }
    return { message: error.message, action: "retry" };
  }
  if (error instanceof Error) {
    return { message: error.message, action: "retry" };
  }
  return { message: "An unexpected error occurred.", action: "retry" };
}
