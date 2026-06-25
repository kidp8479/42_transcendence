// Entry point for the _public/ folder.
// TanStack Router requires a route.tsx inside each folder to treat it as a layout route.
// Without this file, _public/ is just a folder - the router ignores it entirely.
// This file makes _public/ a pathless layout - its name does not appear in the URL.
// Every page inside _public/ (about, contact, terms...) is automatically wrapped by PublicLayout.
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../../components/layout/PublicLayout";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});
