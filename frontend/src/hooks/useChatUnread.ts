import { useSyncExternalStore } from "react";
import { chatUnreadResource } from "@/lib/chatUnreadState";

// Set of projectIds with an unread chat message - see chatUnreadState.ts.
export function useChatUnread(): Set<string> {
  return useSyncExternalStore(
    (listener) => chatUnreadResource.subscribe(listener),
    () => chatUnreadResource.getState()
  );
}
