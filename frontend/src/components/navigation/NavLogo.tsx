import { Link } from "@tanstack/react-router";
import { FcMindMap } from "react-icons/fc";

interface NavLogoProps {
  to: string;
}

export function NavLogo({ to }: NavLogoProps) {
  return (
    <Link
      to={to}
      aria-label="42 Project Planner home"
      className="group flex shrink-0 items-center gap-3"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand-500/30 bg-brand-500/10 shadow-sm shadow-brand-500/10 transition group-hover:border-brand-500/60 group-hover:bg-brand-500/15">
        <FcMindMap className="h-7 w-7" aria-hidden="true" />
      </span>
      <span className="hidden sm:block">
        <span className="block font-mono text-[0.65rem] uppercase tracking-[0.24em] text-brand-500">
          42 workspace
        </span>
        <span className="block text-base font-semibold tracking-tight text-text-primary">
          Project Planner
        </span>
      </span>
    </Link>
  );
}
