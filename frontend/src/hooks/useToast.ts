import { useContext } from "react";
import { ToastContext } from "../components/toast/ToastProvider";

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

// Same as useToast().showToast, but undefined instead of throwing when
// there's no ToastProvider above - needed by anything that can render as
// part of RootErrorComponent (root route's errorComponent), which itself
// renders in RootLayout's place, outside ToastProvider, if RootLayout fails
// to mount. Exported from here (not kept private to one call site) so any
// other component in that same render tree reaches for this instead of
// reintroducing the same crash by calling useToast() directly.
export function useToastIfAvailable() {
  try {
    return useToast().showToast;
  } catch {
    return undefined;
  }
}
