/**
 * Root route ("/").
 * This file must remain named `index.tsx` so the file-based router
 * can resolve the application's entry point.
 * Renders the LandingPage component.
 */
import { createFileRoute } from "@tanstack/react-router";

// TO DISCUSS: if we want logged-in users to skip the landing page and go straight to /dashboard,
// add a beforeLoad here that checks localStorage for a token and throws redirect({ to: '/dashboard' }).
export const Route = createFileRoute("/_public/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-950 py-32 text-white">
      <h1 className="text-4xl font-bold tracking-tight">Transcendence</h1>
      <p className="mt-4 text-gray-400">Tailwind is working.</p>
    </div>
  );
}
