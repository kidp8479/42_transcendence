// Wrapper for all authenticated pages (login required).
// The root application shell owns the authentication-aware header and footer.
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/navigation/Sidebar";

export function AuthenticatedLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
