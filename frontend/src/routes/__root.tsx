import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ModalLayer } from "../components/modals/ModalLayer";
import { ModalProvider } from "../components/modals/ModalProvider";
import { Footer } from "../components/navigation/Footer";
import { HeaderAuthenticated } from "../components/navigation/HeaderAuthenticated";
import { HeaderPublic } from "../components/navigation/HeaderPublic";
import type { AppRouterContext } from "../lib/authState";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context }) => ({
    authState: await context.auth.resolve(),
  }),
  component: RootLayout,
});

function RootLayout() {
  const { authState } = Route.useRouteContext();

  return (
    <ModalProvider>
      <div className="flex min-h-screen flex-col bg-surface-base text-text-primary">
        {authState.status === "authenticated" ? (
          <HeaderAuthenticated session={authState.session} />
        ) : (
          <HeaderPublic authUnavailable={authState.status === "unavailable"} />
        )}
        <div className="flex flex-1 min-h-0">
          <Outlet />
        </div>
        <Footer />
      </div>
      <ModalLayer />
      <TanStackRouterDevtools />
    </ModalProvider>
  );
}
