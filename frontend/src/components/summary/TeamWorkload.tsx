// See DefenseReadiness.tsx (same folder) for an explanation of the pattern
// every component here follows: interface, props destructuring, data flow.
import {
  CATEGORY_COLOR_PALETTE,
  getCategoryColorByName,
} from "@/lib/categoryColorPalette";
import type { CategoryProgress } from "./ProgressByCategory";

export interface TeamMemberWorkload {
  username: string;
  initials: string;
  // index into CATEGORY_COLOR_PALETTE, used for this member's avatar - it's
  // the member's own display color, unrelated to task/calendar categories
  // (User has no color field in schema.prisma yet, this is mock-only for now).
  color: number;
  // tasks assigned to this member that aren't COMPLETED yet
  open_tasks: number;
  // names of the categories this member has open tasks in - matched against
  // categories (by name) to reuse the same color, instead of a separate
  // per-member category color system
  categories: string[];
}

interface TeamWorkloadProps {
  members: TeamMemberWorkload[];
  // needed to look up each member's category tag colors by name
  categories: CategoryProgress[];
}

export function TeamWorkload({ members, categories }: TeamWorkloadProps) {
  return (
    <section
      aria-labelledby="team-workload-heading"
      className="mt-6 rounded-lg border border-surface-border bg-surface-raised p-4"
    >
      <h2
        id="team-workload-heading"
        className="mb-4 text-sm font-semibold text-text-primary"
      >
        Team Workload
      </h2>
      <div className="flex flex-col gap-3">
        {members.map((member) => (
          <div
            key={member.username}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-overlay p-3"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${CATEGORY_COLOR_PALETTE[member.color].bg}`}
              aria-hidden="true"
            >
              {member.initials}
            </div>
            <span className="text-sm font-semibold text-text-primary">
              {member.username}
            </span>
            <span className="text-xs font-semibold text-text-secondary">
              {member.open_tasks} open
            </span>
            <div className="flex flex-wrap gap-2">
              {member.categories.map((category_name) => {
                const category_color = getCategoryColorByName(
                  categories,
                  category_name
                );
                return (
                  <span
                    key={category_name}
                    className={`rounded-md border px-2 py-0.5 text-xs ${category_color.badgeBg} ${category_color.badgeBorder} ${category_color.text}`}
                  >
                    {category_name}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
