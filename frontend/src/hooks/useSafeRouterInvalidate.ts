import { useRouter } from "@tanstack/react-router";

// Wraps router.invalidate() so a failure in it is never mistaken for a
// failure of the mutation that just succeeded. Call this AFTER a mutation's
// own try/catch, never inside it - a real bug came from doing that: an
// error from invalidate() alone rolled back an already-successful save.
export function useSafeRouterInvalidate() {
  const router = useRouter();

  return async function safeInvalidateRouter(): Promise<void> {
    try {
      await router.invalidate();
    } catch (error) {
      console.error("Failed to refresh cached route data", error);
    }
  };
}
