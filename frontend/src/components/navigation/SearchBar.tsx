// Global search input. Submitting navigates to /search?q=.
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
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { darkTextInputTheme } from "../../lib/flowbite";

export function SearchBar() {
  const navigate = useNavigate();
  const { q } = useSearch({ strict: false });
  const [query, setQuery] = useState(typeof q === "string" ? q : "");

  // Syncs on every change of the URL's q, not just on mount: two different
  // /search links visited in a row would otherwise leave the first term in the
  // field. Typing doesn't touch the URL, so this never overwrites a term being
  // typed - it only fires once the navigation has actually happened.
  useEffect(() => {
    setQuery(typeof q === "string" ? q : "");
  }, [q]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return;
    }
    await navigate({ to: "/search", search: { q: normalizedQuery } });
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="w-full">
      {/* The wording matches the four tabs on /search. It used to promise
          "pages" as a result type, which was dropped from the design, and
          "tickets", which the rest of the app calls tasks. */}
      <label htmlFor="global-search" className="sr-only">
        Search projects, tasks and members
      </label>
      <TextInput
        id="global-search"
        icon={HiOutlineMagnifyingGlass}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search projects, tasks, members..."
        sizing="sm"
        theme={darkTextInputTheme}
        type="search"
        value={query}
      />
    </form>
  );
}
