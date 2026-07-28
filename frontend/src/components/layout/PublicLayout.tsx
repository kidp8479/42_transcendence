// Wrapper for all public pages (no login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";

export function PublicLayout() {
  return (
    // The scroller for the public pages (landing, privacy, terms, about...).
    // Here min-h-0 + flex-1 are on the app shell column's main axis, so they
    // give this exactly the height left between the header and the footer.
    <main className="scrollbar-thin-surface min-h-0 flex-1 overflow-y-auto">
      <Outlet />
    </main>
  );
}
