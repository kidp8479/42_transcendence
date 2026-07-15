// Global search input. Submitting navigates to /search?q=.
import { TextInput } from "flowbite-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { darkTextInputTheme } from "../../lib/flowbite";

export function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

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
      <label htmlFor="global-search" className="sr-only">
        Search projects, tickets, members, and pages
      </label>
      <TextInput
        id="global-search"
        icon={HiOutlineMagnifyingGlass}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search projects, tickets, members..."
        sizing="sm"
        theme={darkTextInputTheme}
        type="search"
        value={query}
      />
    </form>
  );
}
