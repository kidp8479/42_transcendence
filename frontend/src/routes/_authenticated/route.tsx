// Entry point for the _authenticated/ folder.
// TanStack Router requires a route.tsx inside each folder to treat it as a layout route.
// Without this file, _authenticated/ is just a folder - the router ignores it entirely.
// This file makes _authenticated/ a pathless layout - its name does not appear in the URL.
// Every page inside _authenticated/ (dashboard, projects...) is automatically wrapped by AuthenticatedLayout.
// The auth guard runs before any _authenticated/ page renders - redirects to / if not logged in.
import { createFileRoute } from "@tanstack/react-router";
import {
  AuthenticatedLayout,
  authGuard,
} from "../../components/layout/AuthenticatedLayout";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: authGuard,
  component: AuthenticatedLayout,
});
