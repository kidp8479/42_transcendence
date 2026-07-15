// Wrapper for all authenticated pages (login required).
// Renders: HeaderAuthenticated + Sidebar + <Outlet /> + Footer
// Also handles the auth guard (redirect to / if not logged in).
import { Outlet, redirect } from "@tanstack/react-router";
import { HeaderAuthenticated } from "../navigation/HeaderAuthenticated";
import { Sidebar } from "../navigation/Sidebar";
import { Footer } from "../navigation/Footer";
import { getSession, type AuthSession } from "../../lib/auth";

interface AuthenticatedLayoutProps {
  session: AuthSession;
}

export function AuthenticatedLayout({ session }: AuthenticatedLayoutProps) {
  return (
    <>
      {/* Top navigation bar - search, notifications, user avatar */}
      <HeaderAuthenticated session={session} />

      {/* Side by side: collapsible sidebar + page content */}
      <div>
        <Sidebar />
        <main>
          {/* The active page (Dashboard, Projects, Settings...) renders here */}
          <Outlet />
        </main>
      </div>

      {/* Footer is shown on all pages, including authenticated ones */}
      <Footer />
    </>
  );
}

// UX gate only - not a security boundary.
// The NestJS global guard remains the authorization boundary.
export async function authGuard() {
  const session = await getSession();
  if (!session) {
    throw redirect({ to: "/" });
  }
  return { session };
}
