// Easter egg page. Was the team's temporary style guide during early
// development (see git history if you need that content back) - replaced
// once the app had enough real screens to reference instead. Not routed to
// from anywhere yet; the plan is a click on the logo while already on the
// landing page.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "flowbite-react";

export const Route = createFileRoute("/_public/dont-panic")({
  component: DontPanicPage,
});

function DontPanicPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="relative max-w-sm rounded-2xl border-2 border-brand-500 bg-surface-raised px-6 py-5 text-center shadow-lg shadow-brand-500/10">
        <p className="font-semibold text-text-primary">
          Stop snooping around our website
        </p>
        <p className="text-text-secondary">and go get me some kibble.</p>
        {/* Speech bubble tail - a rotated square clipped to a corner, borrowing
        the bubble's own border/background so it reads as one seamless shape. */}
        <span
          aria-hidden="true"
          className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-brand-500 bg-surface-raised"
        />
      </div>

      <img
        src="/images/moulinette.jpg"
        alt="Moulinette the cat, unimpressed"
        className="max-h-80 w-full max-w-sm rounded-lg border border-surface-border object-cover"
      />

      <p className="font-mono text-xs tracking-wider text-text-muted uppercase">
        Moulinette · 42 Paris
      </p>

      <Button color="dark" onClick={() => navigate({ to: "/" })}>
        Fine, I'll leave
      </Button>
    </div>
  );
}
