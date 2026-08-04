// Wrapper for all public pages (no login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";

export function PublicLayout() {
  return (
    // The scroller for the public pages (landing, privacy, terms, about...).
    // min-h-0 + flex-1 are on the app shell column's main axis, so this claims
    // the space left between the header and the footer - but it only BOUNDS that
    // space when an ancestor carries a real height. __root.tsx is min-h-screen (a
    // floor, not a height), so this only gets a real bounded height on a page
    // shorter than one viewport; on a long page, content grows past that floor
    // and the page scrolls rather than this box.
    <main className="scrollbar-thin-surface min-h-0 flex-1 overflow-y-auto">
      <Outlet />
    </main>
  );
}
