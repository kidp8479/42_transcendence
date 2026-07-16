// Wrapper for all authenticated pages (login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";
import { SideBarCmp } from "../navigation/SideBarCmp";

export function AuthenticatedLayout() {
  return (
    <div className="flex min-h-0 flex-1">
      <SideBarCmp />
      <main className="min-w-0 flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
