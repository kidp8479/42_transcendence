import { useRouter } from "@tanstack/react-router";
import { useToast } from "./useToast";

// Wraps router.invalidate() so a failure in it is never mistaken for a
// failure of the mutation that just succeeded. Call this AFTER a mutation's
// own try/catch, never inside it - a real bug came from doing that: an
// error from invalidate() alone rolled back an already-successful save.
//
// sync: true forces callers to actually wait for the refetch instead of
// TanStack's default background reload (see AuthenticatedLayout.tsx). On
// failure, toast rather than console.error - the subject bans console
// output. That same useToast() call can throw with no ToastProvider above
// it, which happens when RootErrorComponent (root route's errorComponent)
// renders in RootLayout's place after RootLayout itself fails to mount -
// so it's read through useToastIfAvailable() below instead.
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
