import { useRouter } from "@tanstack/react-router";

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
export function useSafeRouterInvalidate() {
  const router = useRouter();

  return async function safeInvalidateRouter(): Promise<void> {
    try {
      await router.invalidate({ sync: true });
    } catch (error) {
      console.error("Failed to refresh cached route data", error);
    }
  };
}
