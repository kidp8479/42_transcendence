// Sorting on /search: which field, and which direction.
//
// Two controls rather than one four-entry select, because the API has two
// parameters - `sort` and `order` - and folding them into a single list
// ("Name A-Z", "Name Z-A", "Newest", "Oldest") would mean unfolding them again
// on the way out, plus four labels to keep in sync with two enums.
//
// Shown on every tab: the sort applies to all three result groups, including
// the five-row previews on All.
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiOutlineChevronDown,
  HiOutlineArrowDown,
  HiOutlineArrowUp,
} from "react-icons/hi2";
import { darkDropdownTheme } from "@/lib/flowbite";
import type { SearchSort } from "@/lib/searchApi";
import type {
  SearchPageParams,
  SearchPageSearch,
} from "@/lib/searchPageParams";
import {
  SEARCH_CONTROL_TRIGGER_CLASS,
  searchDropdownItemTheme,
} from "@/components/search/searchControlStyles";

interface SearchSortControlProps {
  params: SearchPageParams;
  onChange: (patch: Partial<SearchPageSearch>) => void;
}

// "name" sorts on whichever column plays that role for a type: a project's
// name, a task's title, a member's username.
const SORT_LABELS: Record<SearchSort, string> = {
  name: "Name",
  recent: "Recently updated",
};

const SORT_OPTIONS: SearchSort[] = ["name", "recent"];

export function SearchSortControl({
  params,
  onChange,
}: SearchSortControlProps) {
  const isAscending = params.order === "asc";

  return (
    <div className="flex items-center gap-2">
      <Dropdown
        arrowIcon={false}
        inline
        placement="bottom-start"
        theme={darkDropdownTheme}
        // see ProjectCard.tsx - without border-solid, Flowbite's dark:border-none
        // default strips the panel's outline
        className="border-solid dark:border-solid"
        renderTrigger={() => (
          <button type="button" className={SEARCH_CONTROL_TRIGGER_CLASS}>
            Sort: {SORT_LABELS[params.sort]}
            <HiOutlineChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      >
        {SORT_OPTIONS.map((sort) => (
          <DropdownItem
            key={sort}
            theme={searchDropdownItemTheme}
            onClick={() => onChange({ sort })}
          >
            {SORT_LABELS[sort]}
          </DropdownItem>
        ))}
      </Dropdown>

      <button
        type="button"
        onClick={() => onChange({ order: isAscending ? "desc" : "asc" })}
        // The arrow alone says nothing to a screen reader, and the label has to
        // describe what the button DOES, not the state it is in.
        aria-label={
          isAscending ? "Sort in descending order" : "Sort in ascending order"
        }
        title={isAscending ? "Ascending" : "Descending"}
        className={SEARCH_CONTROL_TRIGGER_CLASS}
      >
        {isAscending ? (
          <HiOutlineArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <HiOutlineArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
