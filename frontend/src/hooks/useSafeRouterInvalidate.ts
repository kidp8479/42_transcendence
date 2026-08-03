import { useRouter } from "@tanstack/react-router";
import { useToast } from "./useToast";

// Wraps router.invalidate() so a failure in it is never mistaken for a
// failure of the mutation that just succeeded. Call this AFTER a mutation's
// own try/catch, never inside it - a real bug came from doing that: an
// error from invalidate() alone rolled back an already-successful save.
//
// sync: true - router.invalidate() defaults to a BACKGROUND reload: the
// returned promise resolves immediately without waiting for the refetch to
// land in the store (see AuthenticatedLayout.tsx for the full writeup of
// this footgun, found via live debugging). Callers of this hook await the
// result specifically to see their OWN change reflected right after
// (ex: a status toggle's label, or the projects list right after leaving)
// - without sync: true that data can still be stale when they check it.
//
// Toast, not console.error, on failure - the subject requires zero console
// output, so a silent console.error here would be both invisible to the
// user and a spec violation.
//
// Also used by RootErrorComponent, the root route's own errorComponent -
// which can render in place of RootLayout itself (and therefore outside
// ToastProvider, one of RootLayout's children) if RootLayout fails to
// mount. useToast() throws without a provider, so it's called through
// useToastIfAvailable() below instead of failing this last-resort error
// screen too.
export function useSafeRouterInvalidate() {
  const router = useRouter();
  const showToast = useToastIfAvailable();

  return async function safeInvalidateRouter(): Promise<void> {
    try {
      await router.invalidate({ sync: true });
    } catch {
      showToast?.({
        type: "error",
        message:
          "Your change was saved, but the page may show stale data. Refresh to see it.",
      });
    }
  };
}

function useToastIfAvailable() {
  try {
    return useToast().showToast;
  } catch {
    return undefined;
  }
}
