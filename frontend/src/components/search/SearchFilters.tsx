// The secondary filters on /search: a status dropdown and the "Include
// archived" toggle.
//
// Both are contextual, and the rule is simple - never show a control the
// server would ignore. SearchService applies `status` only to the type that
// owns the enum value and skips it entirely on type=all, so the dropdown
// appears on Projects and Tasks only. `includeArchived` reaches both the
// project predicate and the task one (a task is archived with its project), so
// its toggle stays up on All, Projects and Tasks alike - hiding it on a tab it
// actually filters would let it silently shape the results and the tab counter.
// Members are the only group it says nothing about.
//
// Pure and prop-driven, like every component under components/. It emits a
// patch and the route decides what that means for the URL - which is also
// where the "any filter change goes back to page 1" rule lives, once.
import { Dropdown, DropdownItem, ToggleSwitch } from "flowbite-react";
import { HiOutlineChevronDown } from "react-icons/hi2";
import { darkDropdownTheme } from "@/lib/flowbite";
import {
  PROJECT_STATUS_ORDER,
  PROJECT_STATUS_STYLES,
} from "@/lib/projectStatusStyles";
import type { SearchStatusFilter } from "@/lib/searchApi";
import type {
  SearchPageParams,
  SearchPageSearch,
} from "@/lib/searchPageParams";
import { STATUS_ORDER, STATUS_STYLES } from "@/lib/taskStatusStyles";
import {
  SEARCH_CONTROL_TRIGGER_CLASS,
  searchDropdownItemTheme,
} from "@/components/search/searchControlStyles";

interface SearchFiltersProps {
  params: SearchPageParams;
  onChange: (patch: Partial<SearchPageSearch>) => void;
}

export function SearchFilters({ params, onChange }: SearchFiltersProps) {
  const statusOptions = buildStatusOptions(params.type);
  // Everything but Members: the server filters archived projects out of the
  // task results too, so the Tasks tab needs the same control as the Projects
  // one - without it the filter is on and there is no way to turn it off.
  const canIncludeArchived = params.type !== "users";

  // Nothing applies on the Members tab - render no toolbar rather than an
  // empty flex row that still eats a gap.
  if (statusOptions.length === 0 && !canIncludeArchived) {
    return null;
  }

  const activeStatusLabel =
    statusOptions.find((option) => option.value === params.status)?.label ??
    "Any status";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {statusOptions.length > 0 && (
        <Dropdown
          arrowIcon={false}
          inline
          placement="bottom-start"
          theme={darkDropdownTheme}
          // Flowbite's own dark:border-none default otherwise wins over the
          // border darkDropdownTheme sets, and the panel loses its outline -
          // see the same note in ProjectCard.tsx.
          className="border-solid dark:border-solid"
          renderTrigger={() => (
            <button type="button" className={SEARCH_CONTROL_TRIGGER_CLASS}>
              Status: {activeStatusLabel}
              <HiOutlineChevronDown
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </button>
          )}
        >
          <DropdownItem
            theme={searchDropdownItemTheme}
            onClick={() => onChange({ status: undefined })}
          >
            Any status
          </DropdownItem>
          {statusOptions.map((option) => (
            <DropdownItem
              key={option.value}
              theme={searchDropdownItemTheme}
              onClick={() => onChange({ status: option.value })}
            >
              {option.label}
            </DropdownItem>
          ))}
        </Dropdown>
      )}

      {canIncludeArchived && (
        <label className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
          <ToggleSwitch
            checked={params.includeArchived}
            onChange={(checked) => onChange({ includeArchived: checked })}
            color="green"
            sizing="sm"
            // Flowbite renders its own label element, so this stays empty and
            // the text lives in the span next to it (same as projects.tsx).
            label=""
            // Its default group-focus:ring-4 reads as huge next to an "sm"
            // toggle - shrunk here only, not in the shared theme.
            theme={{ toggle: { base: "group-focus:ring-1" } }}
          />
          <span>Include archived</span>
        </label>
      )}
    </div>
  );
}

// The two enums never mix: the tab you are on decides which one is offered,
// and SearchTabs drops the status when you switch, so a TaskStatus can't be
// left over on the Projects tab.
function buildStatusOptions(
  type: SearchPageParams["type"]
): { value: SearchStatusFilter; label: string }[] {
  if (type === "projects") {
    return PROJECT_STATUS_ORDER.map((status) => ({
      value: status,
      label: PROJECT_STATUS_STYLES[status].label,
    }));
  }
  if (type === "tasks") {
    return STATUS_ORDER.map((status) => ({
      value: status,
      label: STATUS_STYLES[status].label,
    }));
  }
  return [];
}
