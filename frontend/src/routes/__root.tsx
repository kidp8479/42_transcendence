// The root route, the one component that is always rendered, for every URL.
// Think of it as the outermost box that contains the entire app.
// Every other route (_public, _authenticated, and their pages) renders inside its <Outlet />.


import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
