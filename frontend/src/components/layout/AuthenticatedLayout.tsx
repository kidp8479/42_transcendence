// Wrapper for all authenticated pages (login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "../navigation/Sidebar";

export function AuthenticatedLayout() {
  return (
    <div>
      <Sidebar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
