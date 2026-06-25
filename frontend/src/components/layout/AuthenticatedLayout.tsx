// Wrapper for all authenticated pages (login required).
// Renders: HeaderAuthenticated + Sidebar + <Outlet /> + Footer
// Also handles the auth guard (redirect to / if not logged in).
import { Outlet, redirect } from '@tanstack/react-router'
import { HeaderAuthenticated } from '../navigation/HeaderAuthenticated'
import { Sidebar } from '../navigation/Sidebar'
import { Footer } from '../navigation/Footer'

export function AuthenticatedLayout() {
  return (
    <>
      {/* Top navigation bar - search, notifications, user avatar */}
      <HeaderAuthenticated />

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
  )
}

// Auth guard - called by _authenticated/route.tsx before rendering any authenticated page.
// If no token is found in localStorage, redirects to the landing page (/).
// This function runs for every route under _authenticated/, no need to repeat it per page.
export function authGuard() {
  if (!localStorage.getItem('token')) {
    throw redirect({ to: '/' })
  }
}
