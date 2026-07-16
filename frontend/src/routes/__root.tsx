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
      {authState.status === "authenticated" ? (
          <HeaderAuthenticated session={authState.session} />
      ) : (
          <HeaderPublic authUnavailable={authState.status === "unavailable"} />
      )}
      <Outlet />
      <Footer />
      <ModalLayer />
      <TanStackRouterDevtools />
    </ModalProvider>
  );
}
