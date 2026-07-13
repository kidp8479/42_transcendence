import { Link } from "@tanstack/react-router";
//import { FcParallelTasks } from "react-icons/fc";
import { FcMindMap } from "react-icons/fc";
//import { FcInspection } from "react-icons/fc";
//import { FcTimeline } from "react-icons/fc";

interface NavLogoProps {
  to: string;
}

export function NavLogo({ to }: NavLogoProps) {
  return (
    <Link to={to} className="flex items-center gap-3">
      <FcMindMap className="h-8 w-8" />

      <span className="text-x1 font-semibold text-text-primary">
        42 Project Planner
      </span>
    </Link>
  );
}
