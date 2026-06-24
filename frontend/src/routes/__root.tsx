// The root route, the one component that is always rendered, for every URL.
// Think of it as the outermost box that contains the entire app.
// Every other route (_public, _app, and their pages) renders inside its <Outlet />.
//
// TEMPORARY - the nav links below are only here to test that routes work during development.
// Nav links will eventually live in HeaderPublic.tsx and HeaderAuthenticated.tsx.
// Final version will look minimalistic like this:
//
// export const Route = createRootRoute({
//   component: () => (
//     <>
//       <Outlet />
//       <TanStackRouterDevtools />
//     </>
//   )
// })
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="flex gap-2 p-2">

		{/* ./routes/index.tsx */}
        <Link to="/">Home</Link>{'|'}

		{/* ./routes/_public/*.tsx */}
        <Link to="/about">About</Link>{'|'}
        <Link to="/contact">Contact</Link>{'|'}
        <Link to="/terms">Terms</Link>{'|'}
        <Link to="/privacy">Privacy</Link>{'|'}
        <Link to="/forgot-password">Forgot Password</Link>{'|'}

		{/* ./routes/_app/app.tsx */}
        <Link to="/app">App</Link>

      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
});
