import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getRealtimeSocket } from "@/lib/realtimeSocket";

interface ScopeFilter<T> {
  value: string;
  getValue: (item: T) => string;
}

// Shared by evaluation-checklist.tsx and discovery_.$discoveryBlockId.edit.tsx:
// both listen for "<prefix>:created"/"updated"/"deleted" broadcasts and apply
// them to their own local item list the same way - dedup-on-create (an echo
// of this client's own POST shouldn't double up with the response it already
// appended), map-on-update, filter-on-delete.
//
// scope narrows updates to items belonging to this screen only. Discovery
// items are scoped per block (only this block's items should update this
// screen); checklist items aren't scoped at all, since the whole project's
// checklist lives on one page - pass no scope for that case.
export function useLiveItemSync<T extends { id: string }>(
  eventPrefix: string,
  parse: (payload: unknown) => T | null,
  setItems: Dispatch<SetStateAction<T[]>>,
  scope?: ScopeFilter<T>
): void {
  // parse/scope are re-created every render (parse is usually stable, scope
  // isn't - it closes over a route param) - kept in refs so the effect
  // itself only needs to resubscribe when the prefix or scope's actual
  // value changes, not on every render
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    const socket = getRealtimeSocket();

    function inScope(item: T): boolean {
      const currentScope = scopeRef.current;
      return (
        currentScope === undefined ||
        currentScope.getValue(item) === currentScope.value
      );
    }

    function handleUpdated(payload: unknown) {
      const updatedItem = parseRef.current(payload);
      if (updatedItem === null || !inScope(updatedItem)) {
        return;
      }
      setItems((previous) =>
        previous.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem
        )
      );
    }

    function handleCreated(payload: unknown) {
      const createdItem = parseRef.current(payload);
      if (createdItem === null || !inScope(createdItem)) {
        return;
      }
      // ignore an echo of our own create - the caller's own submit handler
      // already appended it locally with the real backend-assigned id
      setItems((previous) =>
        previous.some((item) => item.id === createdItem.id)
          ? previous
          : [...previous, createdItem]
      );
    }

    function handleDeleted(payload: unknown) {
      const deletedItem = parseRef.current(payload);
      if (deletedItem === null || !inScope(deletedItem)) {
        return;
      }
      setItems((previous) =>
        previous.filter((item) => item.id !== deletedItem.id)
      );
    }

    socket.on(`${eventPrefix}:updated`, handleUpdated);
    socket.on(`${eventPrefix}:created`, handleCreated);
    socket.on(`${eventPrefix}:deleted`, handleDeleted);
    return () => {
      socket.off(`${eventPrefix}:updated`, handleUpdated);
      socket.off(`${eventPrefix}:created`, handleCreated);
      socket.off(`${eventPrefix}:deleted`, handleDeleted);
    };
  }, [eventPrefix, setItems, scope?.value]);
}
