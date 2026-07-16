// Wrapper for all public pages (no login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";

export function PublicLayout() {
  return (
    <main>
      <Outlet />
    </main>
  );
}
