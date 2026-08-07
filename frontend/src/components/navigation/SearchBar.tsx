// Global search input. Submitting navigates to /search?q=, and typing drops a
// panel of suggestions under the bar.
//
// The field mirrors the URL: landing on /search?q=zorglub from a link, a
// reload or the Back button has to show that term, or the page displays
// results for something the bar claims nobody searched for.
//
// strict: false is not optional here - this component is mounted in the header
// of EVERY authenticated page (HeaderAuthenticated), so most of the time there
// is no /search match to read search params from, and the strict hook would
// throw. Off that route the value is simply undefined.
import { TextInput } from "flowbite-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import {
  SearchSuggestionsPanel,
  SUGGESTIONS_PANEL_ID,
} from "@/components/search/SearchSuggestionsPanel";
import {
  searchWorkspace,
  SEARCH_QUERY_MIN_LENGTH,
  type SearchResults,
} from "@/lib/searchApi";
import { darkSurfaceTextInputTheme } from "../../lib/flowbite";

// Long enough that typing a word is one request rather than five, short
// enough that the panel feels like it is keeping up.
const SUGGESTION_DEBOUNCE_MS = 250;

export function SearchBar() {
  const navigate = useNavigate();
  const { q } = useSearch({ strict: false });
  const { href } = useLocation();
  const [query, setQuery] = useState(typeof q === "string" ? q : "");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const term = query.trim();
  const isTermSearchable = term.length >= SEARCH_QUERY_MIN_LENGTH;

  // Syncs on every change of the URL's q, not just on mount: two different
  // /search links visited in a row would otherwise leave the first term in the
  // field. Typing doesn't touch the URL, so this never overwrites a term being
  // typed - it only fires once the navigation has actually happened.
  //
  // It only ever copies a term IN. Leaving /search doesn't clear the field,
  // which is what this component did before it read the URL at all: the bar is
  // shared by every page, and wiping what someone typed because they clicked a
  // result would be a new annoyance introduced to fix an old one.
  useEffect(() => {
    if (typeof q === "string") {
      setQuery(q);
    }
  }, [q]);

  // Any navigation closes the panel, which covers clicking a suggestion
  // without putting a click handler on a non-interactive wrapper.
  useEffect(() => {
    setIsPanelOpen(false);
  }, [href]);

  // Debounced fetch. The timer lives in the effect rather than in a ref
  // (ChecklistItemRow's shape, which needs one because it fires from an event
  // handler): here the cleanup already runs on every change of the term and on
  // unmount, which is exactly when the pending request should be dropped.
  //
  // Gated on the panel being open, so arriving on /search?q=... - which fills
  // the field through the effect above - doesn't fire a second, invisible
  // search next to the one the route's loader is already running.
  useEffect(() => {
    // Below the minimum the DTO answers 400. The page's loader has the same
    // guard; here there is no error boundary at all to catch it.
    if (!isPanelOpen || !isTermSearchable) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchWorkspace({ q: term })
        .then((found) => {
          if (!cancelled) {
            setResults(found);
          }
        })
        .catch((error: unknown) => {
          // Deliberately no toast: suggestions are a convenience, and one
          // toast per failed keystroke is spam. The field still works, and
          // Enter still leads to the results page, which does report errors.
          console.error("Failed to load search suggestions", error);
          if (!cancelled) {
            setResults(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, isTermSearchable, isPanelOpen]);

  // Escape closes the panel, and both calls below are load-bearing, for two
  // unrelated reasons:
  //
  //   stopPropagation - SideBarCmp listens for Escape on window, further along
  //     the bubble path, so without it closing this panel would also close the
  //     mobile sidebar. Same conflict DrawerShell documents.
  //   preventDefault - the field is type="search", whose browser default on
  //     Escape is to clear itself. Without it, "Escape closes the panel" also
  //     means "Escape wipes what I typed" - and the emptied term then falls
  //     below the minimum, so the panel would have vanished on its own even if
  //     the close above were removed.
  //
  // The listener only exists while the panel is open, so a closed panel still
  // leaves Escape to the browser and to the sidebar, which is where clearing
  // the field remains a reasonable thing for Escape to do.
  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setIsPanelOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen]);

  // Click outside. No such pattern existed in this app before - every other
  // menu is a Flowbite Dropdown, which handles dismissal internally, or a
  // drawer with a backdrop. mousedown rather than click so the panel is gone
  // before the click lands on whatever was underneath it.
  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }
    function handleMouseDown(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isPanelOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPanelOpen(false);

    if (!term) {
      // An emptied field submitted from /search clears the page, instead of
      // leaving results on screen for a term the bar no longer shows. Anywhere
      // else an empty submit does nothing at all - landing on a blank results
      // page because Enter was pressed in an empty header field would be a
      // navigation nobody asked for. `q` is only a string on /search, which is
      // what tells the two apart.
      if (typeof q === "string" && q !== "") {
        await navigate({ to: "/search", search: { q: "" } });
      }
      return;
    }

    await navigate({ to: "/search", search: { q: term } });
  }

  return (
    // relative anchors the suggestions panel; the form is already the exact
    // width of the input, so the panel needs no measurement and the header's
    // own wrapper stays untouched.
    <form
      ref={formRef}
      role="search"
      onSubmit={handleSubmit}
      className="relative w-full"
    >
      {/* The wording matches the four tabs on /search. It used to promise
          "pages" as a result type, which was dropped from the design, and
          "tickets", which the rest of the app calls tasks. */}
      <label htmlFor="global-search" className="sr-only">
        Search projects, tasks and members
      </label>
      <TextInput
        id="global-search"
        // Deliberately NOT the full ARIA combobox: the panel holds real <a>
        // results that Tab already walks in DOM order, and role="listbox" with
        // role="option" children would strip them of exactly that, in exchange
        // for arrow-key navigation this would then have to implement by hand.
        //
        // aria-controls only, and no aria-expanded: this input maps to the
        // searchbox role, which supports the global properties plus a short
        // list of its own - and aria-expanded is in neither, so an authoring
        // tool flags it rather than reading it. What tells a screen reader the
        // panel appeared is its aria-live region, not an attribute here.
        aria-controls={SUGGESTIONS_PANEL_ID}
        icon={HiOutlineMagnifyingGlass}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsPanelOpen(true);
        }}
        onFocus={() => setIsPanelOpen(true)}
        placeholder="Search projects, tasks, members..."
        sizing="sm"
        // surface tokens, not control-*: the latter is the lighter blue-grey
        // meant for the auth forms, and against the header's dark background
        // it made the field glow. This is the field palette every other dark
        // page uses.
        theme={darkSurfaceTextInputTheme}
        type="search"
        value={query}
      />
      {isPanelOpen && isTermSearchable && (
        <SearchSuggestionsPanel
          query={term}
          results={results}
          loading={loading}
        />
      )}
    </form>
  );
}
