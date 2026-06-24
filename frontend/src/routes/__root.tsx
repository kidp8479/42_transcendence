// Standard root route
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="flex gap-2 p-2">

		{/* ./routes/index.tsx */}
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>{'|'}

		{/* ./routes/_public/*.tsx */}
        <Link to="/about" className="[&.active]:font-bold">
          About
        </Link>{'|'}
        <Link to="/contact" className="[&.active]:font-bold">
          Contact
        </Link>{'|'}
        <Link to="/terms" className="[&.active]:font-bold">
          Terms
        </Link>{'|'}
        <Link to="/privacy" className="[&.active]:font-bold">
          Privacy
        </Link>{'|'}
        <Link to="/forgot-password" className="[&.active]:font-bold">
          Forgot Password
        </Link>{'|'}

		{/* ./routes/_app/app.tsx */}
        <Link to="/app" className="[&.active]:font-bold">
          App
        </Link>

      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
});
