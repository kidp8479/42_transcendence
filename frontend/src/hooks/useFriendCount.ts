import { useSyncExternalStore } from "react";
import { friendCountResource } from "@/lib/friendCountState";

// Count of settled (ACCEPTED) friendships, kept live - see friendCountState.ts.
// null while the initial fetch is still in flight.
export function useFriendCount(): number | null {
  return useSyncExternalStore(
    (listener) => friendCountResource.subscribe(listener),
    () => friendCountResource.getState()
  );
}
