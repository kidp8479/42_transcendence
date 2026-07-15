import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ModalLayer } from "../components/modals/ModalLayer";
import { ModalProvider } from "../components/modals/ModalProvider";

export const Route = createRootRoute({
  component: () => (
    <ModalProvider>
      <Outlet />
      <ModalLayer />
      <TanStackRouterDevtools />
    </ModalProvider>
  ),
});
