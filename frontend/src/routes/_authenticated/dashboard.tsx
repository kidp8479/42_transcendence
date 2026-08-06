// Dashboard (/dashboard). Kept intentionally light for now - just the
// welcome header plus the one stat card backed by real data (count of
// non-archived, IN_PROGRESS projects, already loaded by the _authenticated
// loader).
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineFolder,
  HiOutlineUsers,
} from "react-icons/hi2";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const projects = useLoaderData({ from: "/_authenticated" });
  const { session } = Route.useRouteContext();

  const activeProjectCount = projects.filter(
    (project) => project.status === "IN_PROGRESS" && !project.isArchived
  ).length;

  return (
    <div className="p-6">
      <p className="font-mono text-xs tracking-wider text-text-secondary uppercase">
        Welcome back
      </p>
      <h1 className="mt-1 text-2xl font-bold text-text-primary">
        Hey, {session.user.username} 👋
      </h1>

      <div className="mt-6 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to="/projects"
          className="rounded-lg border border-surface-border bg-surface-raised p-4 transition hover:border-brand-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Active Projects</span>
            <HiOutlineFolder className="size-5 text-brand-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-text-primary">
            {activeProjectCount}
          </p>
        </Link>

        {/* Draft tiles, agreed with the team on Discord 2026-08-03: chat and
        friends aren't built yet, these just link to their (stub) pages so
        whoever picks up that feature has a real route to wire up rather
        than inventing the entry point later. */}
        <Link
          to="/chat"
          className="rounded-lg border border-surface-border bg-surface-raised p-4 transition hover:border-brand-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Chat</span>
            <HiOutlineChatBubbleLeftRight className="size-5 text-brand-500" />
          </div>
          <p className="mt-2 text-xs text-text-secondary">Coming soon</p>
        </Link>

        <Link
          to="/friends"
          className="rounded-lg border border-surface-border bg-surface-raised p-4 transition hover:border-brand-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Friends</span>
            <HiOutlineUsers className="size-5 text-brand-500" />
          </div>
          <p className="mt-2 text-xs text-text-secondary">Coming soon</p>
        </Link>
      </div>
    </div>
  );
}
