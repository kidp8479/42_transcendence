import { Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { authSessionResource } from "@/lib/authState";

// Shared by RootErrorComponent.tsx (route loader/component failures) and
// routes/$.tsx (unmatched URLs) so both dead-end screens present the same
// box and the same fix applies to both at once.
interface ErrorScreenProps {
  message: string;
  onRetry?: () => void;
  showGoHome?: boolean;
}

export function ErrorScreen({
  message,
  onRetry,
  showGoHome,
}: ErrorScreenProps) {
  // A logged-out visitor sent to /dashboard just gets silently bounced back
  // to / by _authenticated's own guard - point them at / directly instead,
  // matching whichever page they can actually reach.
  const authState = useSyncExternalStore(
    (listener) => authSessionResource.subscribe(listener),
    () => authSessionResource.getState(),
    () => null
  );
  const isAuthenticated = authState?.status === "authenticated";

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
        {showGoHome && (
          <Link
            to={isAuthenticated ? "/dashboard" : "/"}
            className="rounded-md border border-red-100 px-4 py-2 text-sm font-medium hover:bg-red-900"
          >
            {isAuthenticated ? "Go to Dashboard" : "Go to Home"}
          </Link>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-red-100 px-4 py-2 text-sm font-medium hover:bg-red-900"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
